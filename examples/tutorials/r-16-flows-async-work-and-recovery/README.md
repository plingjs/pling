# R-16 · Flows, async work, and recovery

This fixture switches to a small React order desk. Changing a note is declared as
one four-step flow: restore the All filter, open the target order, fill the note,
and wait for a delayed save. Locking saving demonstrates a resumable failure at
the final step without replaying the first three.

Run it with `pnpm tutorial:dev r-16`; the page is served at
`http://127.0.0.1:5256/`.
