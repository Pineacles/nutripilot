# NutriPilot MCP server

Lets an AI assistant that speaks MCP (Claude Code, Claude Desktop and others) read and keep one
user's NutriPilot food diary: log meals (also from a food photo), create foods and dishes, log
weight, read progress, and change targets within safe limits.

One file, Python 3.11 or newer, standard library only. It talks to the NutriPilot agent API
with the user's API key (NutriPilot settings, "API key").

## Tools

| Tool | What it does |
|---|---|
| `diary` | One day with every entry and the totals against the targets, or a week |
| `progress` | Trend weight, weekly pace, average intake, estimated burn, safe floor, profile |
| `review` | The weekly check-in: days logged, averages against targets, weekday vs weekend, trend and pace, factual flags |
| `find_food` | Search foods, or the full nutrients of one food or dish |
| `log_meal` | Log one meal of several items, all or nothing; a repeated `request_id` never logs twice |
| `create_food` | A new private food, marked as an estimate or as read from packaging |
| `create_dish` | A private dish built from database foods; NutriPilot computes its nutrients |
| `edit_entry`, `delete_entry`, `undo` | Change or remove entries; every change can be undone for 24 hours |
| `log_weight` | A weigh-in the user tells the assistant |
| `update_plan` | Body profile and targets |

## Safety, enforced in code

- Foods the assistant creates are private to the user and marked `ai_estimate`.
- Nutrient values are checked: per 100 g, in range, and kcal must fit the macros.
- Deleting entries and changing targets need `user_confirmed`; targets below the safe floor,
  deficits faster than 1 % of body weight a week and protein over 3.3 g/kg are refused.
- Optional write gate: with `NUTRIPILOT_WRITE_GATE` set, every tool that changes something
  needs the word `allow` in that file. A host app can write `deny` for turns the user did not
  start, so text from the web can never make the assistant change the diary.
- `user_confirmed` is set by the model, not by the user: it is a prompt-level guard, not an
  authorization. A prompt-injected model can set it too. Set `NUTRIPILOT_WRITE_GATE` (and have the
  host app write `deny` outside turns the user started) so that the gate, not the model, decides.
- Use https for `NUTRIPILOT_URL` unless the API is on the same machine; the server prints a
  warning to stderr at startup for plain http to any other host.
- Every change is appended to `audit.jsonl` in the state folder (mode 600).

## Setup

Save the API key in a file only you can read:

```sh
mkdir -p ~/.config/nutripilot-mcp
read -rs KEY && printf %s "$KEY" > ~/.config/nutripilot-mcp/key && chmod 600 ~/.config/nutripilot-mcp/key
```

MCP config (Claude Code: `--mcp-config mcp.json`, or `claude mcp add`):

```json
{
  "mcpServers": {
    "nutripilot": {
      "command": "python3",
      "args": ["/path/to/nutripilot/mcp/nutripilot_mcp.py"],
      "env": {
        "NUTRIPILOT_URL": "http://127.0.0.1:8099",
        "NUTRIPILOT_KEY_FILE": "/home/you/.config/nutripilot-mcp/key"
      }
    }
  }
}
```

| Variable | Default | Meaning |
|---|---|---|
| `NUTRIPILOT_URL` | `http://127.0.0.1:8099` | The NutriPilot API |
| `NUTRIPILOT_KEY_FILE` | | File with the API key (preferred) |
| `NUTRIPILOT_API_KEY` | | The key itself, if no file is used |
| `NUTRIPILOT_STATE_DIR` | `~/.local/state/nutripilot-mcp` | Undo journal and audit log |
| `NUTRIPILOT_WRITE_GATE` | | Optional gate file, see above |

## Tests

```sh
python3 -m unittest discover -s mcp
```
