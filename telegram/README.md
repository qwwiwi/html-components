# Telegram widget packs

Import the ESM entry point from either Bun bridge. The renderer accepts plain JSON data and returns standalone HTML and a plain-text caption. Send the caption without a parse mode when a widget is unavailable.

```js
import {renderComponent, validate} from './index.mjs';

const data = {title: 'Course progress', label: 'Lessons completed', value: 75};
const result = renderComponent('progress', data, {chatData: true});
```

Each directory in `packs/` contains the input JSON Schema and a renderable example. Templates and caption builders are registered by name in `templates.mjs`. The supported names are `kpi`, `bars`, `progress`, `steps`, `compare`, `pros-cons`, `faq` and `status`. Comparison rows must match the header width. Bars and progress use percentages from 0 through 100. The shared stylesheet follows the device color scheme and uses system fonts.

`validate(name, data)` returns a boolean. On failure, inspect `result.error.code` for `UNKNOWN_PACK`, `INVALID_DATA`, `CHAT_DATA_LIMIT` or `HTML_LIMIT`. Pass `{chatData: true}` when forwarding the input as chat_data. The limit applies to the UTF-8 bytes of compact JSON. HTML budgets apply on every render (32 KiB raw, 4096 bytes zlib level 9). Captions are capped at 1024 UTF-16 code units.

From the repository root, run `bun test telegram/` to exercise all examples and pack budgets.
