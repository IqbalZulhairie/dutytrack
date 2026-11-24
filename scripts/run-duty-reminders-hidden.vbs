If WScript.Arguments.Count <> 3 Then
  WScript.Quit 2
End If

Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = WScript.Arguments(2)

command = """" & WScript.Arguments(0) & """ """ & WScript.Arguments(1) & """ --scheduled"
exitCode = shell.Run(command, 0, True)
WScript.Quit exitCode
