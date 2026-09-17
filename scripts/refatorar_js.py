import os
import re

DIR = '../' # Diretório raiz do FC-Gest-o

def modify_global():
    path = os.path.join(DIR, 'global.js')
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if "window.getEmpresaRef = function" not in content:
        # Procurar por `const firestore = firebase.firestore();`
        injection = """
const firestore = firebase.firestore();

// --- INICIO MULTI-TENANT ---
window.getEmpresaRef = function() {
    const empId = localStorage.getItem('fc_empresa_ativa');
    if (!empId) {
        console.error("Nenhuma empresa ativa encontrada no login!");
        // Fallback temporario para nao quebrar em sessoes antigas
        return firestore.collection('empresas').doc('emp_fc_moveis');
    }
    return firestore.collection('empresas').doc(empId);
};
// --- FIM MULTI-TENANT ---
"""
        content = content.replace("const firestore = firebase.firestore();", injection)
        
        # Modificar firestore.collection("fc_moveis") para apontar para a subcolecao de empresa se houver referencias diretas em global
        # Precisamos ter muito cuidado para nao substituir coisas globais como auth.
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("global.js modificado.")

def modify_login():
    path = os.path.join(DIR, 'sistema', 'login.js')
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Vamos injetar a busca da empresa no login
    if "fc_empresa_ativa" not in content:
        # Apos localStorage.setItem('fc_sessao_uid', cred.user.uid);
        search_block = """localStorage.setItem('fc_sessao_uid', cred.user.uid);"""
        
        replace_block = """localStorage.setItem('fc_sessao_uid', cred.user.uid);
            
            // Buscar empresa do usuario
            try {
                const userDoc = await firebase.firestore().collection('usuarios').doc(cred.user.uid).get();
                if (userDoc.exists && userDoc.data().empresaId) {
                    localStorage.setItem('fc_empresa_ativa', userDoc.data().empresaId);
                } else {
                    // Fallback
                    localStorage.setItem('fc_empresa_ativa', 'emp_fc_moveis');
                }
            } catch(e) {
                console.error("Erro ao buscar empresa do usuario", e);
                localStorage.setItem('fc_empresa_ativa', 'emp_fc_moveis');
            }"""
        
        content = content.replace(search_block, replace_block)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("sistema/login.js modificado.")

def modify_firestore_calls():
    # Percorrer todos os arquivos js na pasta sistema/ e global.js
    js_files = []
    
    # Arquivos em sistema/
    sys_dir = os.path.join(DIR, 'sistema')
    for f in os.listdir(sys_dir):
        if f.endswith('.js') and f != 'config_banco.js' and f != 'login.js':
            js_files.append(os.path.join(sys_dir, f))
            
    # global.js
    js_files.append(os.path.join(DIR, 'global.js'))
    # gestao_v2.js, pdv.js, etc (dentro de sistema/)
    # sw.js na raiz
    js_files.append(os.path.join(DIR, 'sw.js'))
    # script.js na raiz (se existir)
    
    for path in js_files:
        if not os.path.exists(path): continue
        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            
        # Nao queremos substituir as que estao definindo getEmpresaRef
        # Regex: firestore\.collection\(("([^"]+)"|'([^']+)')\) -> getEmpresaRef().collection(\1)
        # MAS com cuidado: colecoes raiz globais ("empresas", "usuarios") nao podem ser alteradas.
        # Colecoes a serem substituidas: "produtos", "clientes", "vendas", "fornecedores", 
        # "orcamentos", "pedidos_site", "financeiro", "compras", "notas_servico", 
        # "notas_devolucao", "notas_avulsas", "categorias", "movimentacoes", 
        # "funcionarios", "marketing_historico", "relatorios_ia_historico", "fc_moveis"
        
        collections = [
            "produtos", "clientes", "vendas", "fornecedores", "orcamentos",
            "pedidos_site", "financeiro", "compras", "notas_servico",
            "notas_devolucao", "notas_avulsas", "categorias", "movimentacoes",
            "funcionarios", "marketing_historico", "relatorios_ia_historico"
        ]
        
        new_content = content
        for col in collections:
            # Matches firestore.collection('produtos') or firestore.collection("produtos")
            # Substitui por getEmpresaRef().collection('produtos')
            
            # Formato aspas simples
            pattern1 = r"firestore\.collection\('" + col + r"'\)"
            repl1 = r"window.getEmpresaRef().collection('" + col + r"')"
            new_content = re.sub(pattern1, repl1, new_content)
            
            # Formato aspas duplas
            pattern2 = r'firestore\.collection\("' + col + r'"\)'
            repl2 = r'window.getEmpresaRef().collection("' + col + r'")'
            new_content = re.sub(pattern2, repl2, new_content)
            
        # Casos especiais: firestore.collection('fc_moveis').doc('config')
        # -> window.getEmpresaRef().collection('configuracoes').doc('config')
        new_content = re.sub(
            r"firestore\.collection\(['\"]fc_moveis['\"]\)\.doc\(['\"]config['\"]\)",
            r"window.getEmpresaRef().collection('configuracoes').doc('config')",
            new_content
        )
        new_content = re.sub(
            r"firestore\.collection\(['\"]fc_moveis['\"]\)\.doc\(['\"]config_loja['\"]\)",
            r"window.getEmpresaRef().collection('configuracoes').doc('config_loja')",
            new_content
        )
        new_content = re.sub(
            r"firestore\.collection\(['\"]fc_moveis['\"]\)\.doc\(['\"]caixa['\"]\)",
            r"window.getEmpresaRef().collection('caixa').doc('caixa_atual')",
            new_content
        )
        
        # Tambem db.collection(xxx) que eh usado em functions de firebase as vezes?
        # A maioria eh firestore.collection()
        
        if content != new_content:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Substituicoes aplicadas em {os.path.basename(path)}")

if __name__ == "__main__":
    modify_global()
    modify_login()
    modify_firestore_calls()
    print("Refatoracao concluida com sucesso!")
