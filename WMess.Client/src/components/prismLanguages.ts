// Догружаем популярные грамматики Prism сверх вшитых в @lexical/code-prism (динамической
// загрузки в этой версии нет — только статические импорты). Порядок важен: базовые грамматики
// и зависимости (markup / clike / javascript / typescript / markup-templating) импортируем
// раньше зависимых от них языков (jsx, tsx, php и т.д.).
import 'prismjs'
import 'prismjs/components/prism-markup'
import 'prismjs/components/prism-clike'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-markup-templating'

import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-php'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-json5'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-toml'
import 'prismjs/components/prism-ini'
import 'prismjs/components/prism-go'
import 'prismjs/components/prism-ruby'
import 'prismjs/components/prism-kotlin'
import 'prismjs/components/prism-csharp'
import 'prismjs/components/prism-scala'
import 'prismjs/components/prism-dart'
import 'prismjs/components/prism-scss'
import 'prismjs/components/prism-less'
import 'prismjs/components/prism-lua'
import 'prismjs/components/prism-perl'
import 'prismjs/components/prism-r'
import 'prismjs/components/prism-graphql'
import 'prismjs/components/prism-docker'
import 'prismjs/components/prism-makefile'
import 'prismjs/components/prism-haskell'

// Языки для дропдауна: только реально загруженные грамматики (вшитые в @lexical/code-prism +
// импортированные выше), с человекочитаемыми названиями. Первый пункт сбрасывает язык (без подсветки).
// Значение = id языка в Prism — именно оно пишется в CodeNode.setLanguage().
export const CODE_LANGUAGES: [string, string][] = [
  ['', 'Не определен'],
  ['markup', 'HTML / XML'],
  ['css', 'CSS'],
  ['scss', 'SCSS'],
  ['less', 'Less'],
  ['javascript', 'JavaScript'],
  ['typescript', 'TypeScript'],
  ['jsx', 'JSX'],
  ['tsx', 'TSX'],
  ['json', 'JSON'],
  ['json5', 'JSON5'],
  ['yaml', 'YAML'],
  ['toml', 'TOML'],
  ['ini', 'INI'],
  ['markdown', 'Markdown'],
  ['python', 'Python'],
  ['java', 'Java'],
  ['kotlin', 'Kotlin'],
  ['scala', 'Scala'],
  ['c', 'C'],
  ['cpp', 'C++'],
  ['csharp', 'C#'],
  ['objectivec', 'Objective-C'],
  ['go', 'Go'],
  ['rust', 'Rust'],
  ['swift', 'Swift'],
  ['dart', 'Dart'],
  ['ruby', 'Ruby'],
  ['php', 'PHP'],
  ['perl', 'Perl'],
  ['lua', 'Lua'],
  ['r', 'R'],
  ['haskell', 'Haskell'],
  ['sql', 'SQL'],
  ['bash', 'Bash / Shell'],
  ['powershell', 'PowerShell'],
  ['graphql', 'GraphQL'],
  ['docker', 'Dockerfile'],
  ['makefile', 'Makefile'],
]
