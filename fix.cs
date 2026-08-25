using System;
using System.IO;
using System.Text;

class Program {
    static void Main(string[] args) {
        string[] files = Directory.GetFiles(".", "*.html", SearchOption.AllDirectories);
        var utf8 = new UTF8Encoding(false);
        
        foreach (var file in files) {
            string content = File.ReadAllText(file, utf8);
            
            content = content.Replace("\u00C3\u00A1", "\u00E1"); // ?
            content = content.Replace("\u00C3\u00A2", "\u00E2"); // ?
            content = content.Replace("\u00C3\u00A3", "\u00E3"); // ?
            content = content.Replace("\u00C3\u00A7", "\u00E7"); // ?
            content = content.Replace("\u00C3\u00A9", "\u00E9"); // ?
            content = content.Replace("\u00C3\u00AA", "\u00EA"); // ?
            content = content.Replace("\u00C3\u00AD", "\u00ED"); // ?
            content = content.Replace("\u00C3\u00B3", "\u00F3"); // ?
            content = content.Replace("\u00C3\u00B4", "\u00F4"); // ?
            content = content.Replace("\u00C3\u00B5", "\u00F5"); // ?
            content = content.Replace("\u00C3\u00BA", "\u00FA"); // ?
            
            content = content.Replace("\u00C3\u0080", "\u00C0"); // ?
            content = content.Replace("\u00C3\u0081", "\u00C1"); // ?
            content = content.Replace("\u00C3\u0082", "\u00C2"); // ?
            content = content.Replace("\u00C3\u0083", "\u00C3"); // ?
            content = content.Replace("\u00C3\u0087", "\u00C7"); // ?
            content = content.Replace("\u00C3\u0089", "\u00C9"); // ?
            content = content.Replace("\u00C3\u008A", "\u00CA"); // ?
            content = content.Replace("\u00C3\u008D", "\u00CD"); // ?
            content = content.Replace("\u00C3\u0093", "\u00D3"); // ?
            content = content.Replace("\u00C3\u0094", "\u00D4"); // ?
            content = content.Replace("\u00C3\u0095", "\u00D5"); // ?
            content = content.Replace("\u00C3\u009A", "\u00DA"); // ?

            File.WriteAllText(file, content, utf8);
        }
    }
}
