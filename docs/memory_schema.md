# Chat Memory Table Mapping

Node: `Postgres Chat Memory` → table `messages`

Required columns (present in schema):
- `session_id` (TEXT): groups conversation
- `role` (TEXT: 'user'|'assistant'|'system')
- `message` (TEXT): content
- `user_id` (TEXT, optional): who sent it
- `created_at` (TIMESTAMPTZ): timestamp

Context window length: 10 (adjust in node config)