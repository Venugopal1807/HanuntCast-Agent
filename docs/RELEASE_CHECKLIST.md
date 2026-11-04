> **Historical engineering record (written 2026-10-20 to 2026-10-30).** Statements here about Git state ("uncommitted", "README-only main"), test counts and deployment status are dated. Current status: [README](../README.md), [DEPLOYMENT](../DEPLOYMENT.md), [VALIDATION](../VALIDATION.md). Safety rules in this file still apply.

# Release readiness checklist

## Verified locally

- [x] Git state inspected: only the initial README commit was previously pushed; release work remains uncommitted.
- [x] `.env`, populated `.env.*`, test media/artifacts, ledgers, private proxy files and conversation history excluded from normal staging.
- [x] Offline release audit checks eligible source and built assets for literal configured credentials and private-key/JWT patterns without printing matches.
- [x] Public mode rejects AssemblyAI selection; production secrets require at least 48 characters, variety and no recognized placeholder.
- [x] Live API requires both JWT ownership and an independent server/proxy access token.
- [x] Every actual HTTP/WS synthesis reserves attempts and input characters atomically in an existing SQLite ledger before opening transport.
- [x] Missing/corrupt/locked/exhausted budgets deny synthesis; failed attempts are not refunded. No reset/admin web endpoint exists.
- [x] Mock-only public fallback and no-cost health checks prepared.
- [x] Existing and new non-paid regressions run; final evidence is in VALIDATION.md.

## Operator gates before publication

- [ ] Choose hosting, hostname and HTTPS certificates. Recommended: single Linux host for public mock; restricted loopback/VPN live demo.
- [ ] Install the pinned dependencies on the target OS/Python; run the checks there. Linux installation and nginx/systemd syntax have not been executed here.
- [ ] Audit dependencies against vulnerability advisories if network access is authorized. This run performed no registry/CVE queries.
- [ ] Generate secrets on the target; populate private env files outside the checkout. Never paste them into video, terminal logs or submissions.
- [ ] Confirm only nginx is public and Uvicorn ports are loopback/firewalled. Confirm proxy overwrites forwarding/access headers.
- [ ] For live: establish private network/IP access and an independent proxy token. Never publish the live host anonymously.
- [ ] For live: approve an attempt/character allowance, initialize the ledger once, verify durable local volume and restrictive permissions. Never auto-initialize on restart or restore an older ledger.
- [ ] If persistent storage cannot be guaranteed, keep production public mock-only and perform live recording on a restricted local instance.
- [ ] Review staged files, run the staged audit, then manually commit/push using RELEASE_COMMANDS.md.
- [ ] Approve deployment; run health/mock flow through HTTPS, check streamed response behavior with the free rehearsal where applicable.
- [ ] Record the demo. New live narration requires separate paid-call authorization; none was granted or used in this phase.
- [ ] Fill hosted demo/video/repository fields in SUBMISSION.md and check the hackathon's rules.
- [ ] Perform physical-device audio and assistive-technology review; archive the release identifier and rollback target.

No checklist can prevent deliberate `git add -f` or bypassing hooks. Use the staged audit and explicit path staging; protect secrets through host permissions and repository review too.
