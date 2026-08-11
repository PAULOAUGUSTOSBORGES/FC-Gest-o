$file = 'gestao.html'
$c = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)

$badBox = '<div class="bg-red-50 p-4 rounded-xl border border-red-200 shadow-sm flex flex-col justify-center">'
$goodBox = '<div class="bg-red-50 dark:bg-red-900/30 p-4 rounded-xl border border-red-200 dark:border-red-800 shadow-sm flex flex-col justify-center">'

$badText1 = '<h3 class="text-[10px] font-bold text-red-700 uppercase">'
$goodText1 = '<h3 class="text-[10px] font-bold text-red-700 dark:text-red-400 uppercase">'

$badText2 = '<p class="text-xl font-black text-red-600 mt-1" id="dash-inadimplencia">'
$goodText2 = '<p class="text-xl font-black text-red-600 dark:text-red-500 mt-1" id="dash-inadimplencia">'

$c = $c.Replace($badBox, $goodBox)
$c = $c.Replace($badText1, $goodText1)
$c = $c.Replace($badText2, $goodText2)

[System.IO.File]::WriteAllText($file, $c, [System.Text.Encoding]::UTF8)
