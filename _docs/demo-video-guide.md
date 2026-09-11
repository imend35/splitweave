# SplitWeave demo video guide

## Recording target

- Length: 60–90 seconds
- Format: landscape, 1920×1080 if possible, MP4
- Language: simple English narration or the same lines as on-screen captions
- Recording tool: Windows Snipping Tool (`Win` + `Shift` + `R`) or another screen recorder
- Publish by attaching the finished video directly to the LinkedIn post

## Prepare a clean demo

Use a separate SQLite file so the recording starts with the deterministic **Aegean Weekend** demo group and does not change an existing local database.

In the first VS Code PowerShell terminal:

```powershell
cd backend
$env:SPLITWEAVE_DATABASE_URL="sqlite:///./splitweave-demo-video.db"
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

In the second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Before recording:

1. Open `http://localhost:5173` in Chrome.
2. Open **Aegean Weekend**, then open the same group URL in a second browser window.
3. Keep the first window on **Overview** and the second window on **Expenses**.
4. Set browser zoom to 90% or 100% and close unrelated tabs.
5. Turn on Windows **Do not disturb** so personal notifications do not appear.
6. Test the microphone once; if narration feels difficult, record silently and use the script as captions.

## Expense data used in the recording

| Field | Value |
| --- | --- |
| Expense title | `Museum tickets` |
| Amount | `480.00` |
| Category | `Entertainment` |
| Paid by | `Ada` |
| Participants | Ada, Deniz, Mira, Can |
| Split method | `Percentages` |
| Percentages | 25% for each member (filled automatically) |
| Note | `Demo expense` |

For the repayment, click **Record** on the first settlement suggestion, keep the suggested amount, enter `Demo repayment` as the note, and save it.

## 75-second recording plan

| Time | On-screen action | English narration or caption |
| --- | --- | --- |
| 0–6 sec | Show the groups screen and open **Aegean Weekend**. | “This is SplitWeave, an AI-assisted full-stack application for managing shared expenses.” |
| 6–15 sec | Pause on the group overview, balances, and member cards. | “It gives groups a clear view of total spending, individual balances, and who owes whom.” |
| 15–24 sec | Open **Expenses** and briefly show the history and filters. | “Every expense remains transparent, searchable, and connected to its payer and participants.” |
| 24–42 sec | Click **Add expense**, enter the sample data, select **Percentages**, and save. | “Expenses can be divided equally, by exact amounts, percentages, or weighted shares. SplitWeave handles financial rounding deterministically.” |
| 42–51 sec | Switch to the second window, refresh, and show the new expense and balances. | “The frontend communicates with a FastAPI backend through a centralized API client, so the same data appears across browser sessions.” |
| 51–64 sec | Open **Settle up**, click the first **Record** button, add the note, and save. | “It also generates simplified settlement suggestions and supports full or partial repayment records.” |
| 64–72 sec | Return to the first window, refresh, and show the updated balance. | “Balances are recalculated after every transaction and always reconcile to zero.” |
| 72–82 sec | Show the final overview or a short terminal-to-browser restart cut. | “SQLAlchemy and SQLite keep the data available after refreshes and backend restarts.” |
| 82–88 sec | End on the SplitWeave overview. | “The complete source code, specification, OpenAPI contract, and automated tests are available on GitHub.” |

## Continuous narration script

> This is SplitWeave, an AI-assisted full-stack application for managing shared expenses. It gives groups a clear view of total spending, individual balances, and who owes whom. Every expense remains transparent, searchable, and connected to its payer and participants. Expenses can be divided equally, by exact amounts, percentages, or weighted shares, with deterministic financial rounding. The frontend communicates with a FastAPI backend through a centralized API client, so the same data appears across browser sessions. SplitWeave also generates settlement suggestions and supports full or partial repayments. Balances are recalculated after every transaction and always reconcile to zero. SQLAlchemy and SQLite keep the data available after refreshes and backend restarts. The complete source code, specification, OpenAPI contract, and automated tests are available on GitHub.

## Final quality checklist

- The browser address bar contains only local URLs and no personal information.
- No desktop notifications, emails, passwords, or unrelated tabs appear.
- The mouse moves slowly enough for viewers to follow.
- Important screens remain visible for at least two seconds.
- The finished video is between 60 and 90 seconds.
- The exported MP4 plays from beginning to end and the voice is understandable.
- The LinkedIn post links to `https://github.com/imend35/splitweave`.

If the video is attached directly to LinkedIn, remove the `Demo video: [VIDEO_LINK]` line from the post.
