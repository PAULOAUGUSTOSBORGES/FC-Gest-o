import firebase_admin
from firebase_admin import credentials, firestore
import time

# Script para migrar dados do formato antigo (Single-Tenant) para o novo formato SaaS (Multi-Tenant)
# 
# ANTES DE RODAR:
# 1. Baixe o arquivo JSON de chave privada da conta de servico do Firebase (Configuracoes do Projeto > Contas de Servico > Gerar nova chave privada)
# 2. Salve o arquivo como "serviceAccountKey.json" na mesma pasta deste script.
# 3. Instale a biblioteca do firebase: pip install firebase-admin

EMPRESA_PADRAO_ID = "emp_fc_moveis"

def main():
    print("Iniciando migracao para SaaS...")
    
    try:
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred)
    except Exception as e:
        print("ERRO: Nao foi possivel inicializar o Firebase. Verifique se o serviceAccountKey.json esta na pasta.")
        print(e)
        return

    db = firestore.client()
    
    # 1. Criar a Empresa Mae (O seu cadastro)
    empresa_ref = db.collection("empresas").document(EMPRESA_PADRAO_ID)
    empresa_ref.set({
        "nome": "FC Moveis e Interiores",
        "status": "ATIVO",
        "plano": "ILIMITADO",
        "dataCriacao": firestore.SERVER_TIMESTAMP
    }, merge=True)
    print(f"Empresa '{EMPRESA_PADRAO_ID}' garantida no banco.")

    colecoes_para_migrar = [
        "produtos",
        "clientes",
        "vendas",
        "fornecedores",
        "orcamentos",
        "pedidos_site",
        "financeiro",
        "compras",
        "notas_servico",
        "notas_devolucao",
        "notas_avulsas",
        "categorias",
        "movimentacoes",
        "funcionarios",
        "marketing_historico",
        "relatorios_ia_historico"
    ]

    for colecao in colecoes_para_migrar:
        print(f"\nMigrando colecao: {colecao}...")
        docs = db.collection(colecao).stream()
        count = 0
        
        for doc in docs:
            dados = doc.to_dict()
            
            # Se for funcionario, precisamos criar o mapeamento global em "usuarios"
            if colecao == "funcionarios":
                db.collection("usuarios").document(doc.id).set({
                    "email": dados.get("email", ""),
                    "empresaId": EMPRESA_PADRAO_ID,
                    "nome": dados.get("nome", ""),
                    "role": "admin" if dados.get("isAdmin") else "operador"
                }, merge=True)
            
            # Copiar documento para a subcolecao da empresa
            empresa_ref.collection(colecao).document(doc.id).set(dados)
            count += 1
            
        print(f"  -> {count} documentos copiados para empresas/{EMPRESA_PADRAO_ID}/{colecao}")

    # Migrar a config_loja e config
    print("\nMigrando configuracoes (fc_moveis)...")
    try:
        config_doc = db.collection("fc_moveis").document("config").get()
        if config_doc.exists:
            empresa_ref.collection("configuracoes").document("config").set(config_doc.to_dict())
            print("  -> Configuracoes copiadas.")
            
        config_loja_doc = db.collection("fc_moveis").document("config_loja").get()
        if config_loja_doc.exists:
            empresa_ref.collection("configuracoes").document("config_loja").set(config_loja_doc.to_dict())
            print("  -> Config_loja copiada.")
            
        caixa_doc = db.collection("fc_moveis").document("caixa").get()
        if caixa_doc.exists:
            empresa_ref.collection("caixa").document("caixa_atual").set(caixa_doc.to_dict())
            print("  -> Caixa copiado.")
    except Exception as e:
        print("  -> Erro ao migrar configs:", e)

    print("\n=======================================================")
    print("MIGRACAO CONCLUIDA COM SUCESSO!")
    print("Os dados originais nao foram apagados, entao seu sistema atual nao vai quebrar.")
    print("Assim que voce testar e confirmar que o SaaS esta funcionando 100%, voce podera deletar as colecoes raiz.")
    print("=======================================================")

if __name__ == "__main__":
    main()
