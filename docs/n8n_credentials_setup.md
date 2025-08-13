# n8n Credential Setup

The exported workflow references credential entries by ID and name. After importing the workflow into your n8n instance, follow these steps to wire credentials without editing the workflow JSON:

1. Open *Credentials* in the n8n sidebar.
2. Create new credentials for each of the following services:
   - **Postgres**: Use the values from your `.env` or Docker environment (`postgres`, password `postgres`, database `invoicing`).
   - **HTTP Header Auth**: Add the static header required for the webhook (e.g. `X-API-KEY`).
   - **OpenAI**: Paste your `OPENAI_API_KEY`.
   - **Google Drive** (optional): Authorise access to the folder to monitor.
3. Note the **Name** you assign each credential. The workflow will match on the `name` field.
4. If the imported workflow shows broken credential references, edit each affected node and select the matching credential from the list.
5. Save the workflow and activate.

> Tip: n8n **environment credential overrides** are not supported for all node types. The safest approach is to configure credentials via the UI or use the n8n [credential variables](https://docs.n8n.io/hosting/environment-variables/#credential-overrides) feature.