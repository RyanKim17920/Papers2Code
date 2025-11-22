# Work Notes

## Task: Expand Dex mock accounts for GitHub/Google
- [ ] Confirm how Dex mock connector behaves today (it uses a single default user because config is empty).
- [ ] Add explicit user lists for the mock GitHub and Google connectors so we can choose among many fake identities.
- [ ] Ensure at least one GitHub/Google pair share the same email so we can test account linking/merging flows.
- [ ] Document how to add more fake accounts (and explain that static password entries already use the shared bcrypt hash).
