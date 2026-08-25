var fso = new ActiveXObject("Scripting.FileSystemObject");
var file = fso.OpenTextFile("g:/VERSOES DO SISTEMA/site sistema/caixa.js", 1);
var content = file.ReadAll();
file.Close();
try {
    eval("function dummy() { " + content + " }");
    WScript.Echo("No syntax errors detected.");
} catch(e) {
    WScript.Echo("Syntax error: " + e.message + " at line " + (e.line || "unknown"));
}
