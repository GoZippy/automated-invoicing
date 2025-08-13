### Alerting

Slack Webhook
- Set `SLACK_WEBHOOK_URL` in `.env`
- Use `scripts/notify_slack.sh "Message text"`

Suggested Alerts
- Extraction failure rate threshold reached
- DB insert errors
- Overdue job failure