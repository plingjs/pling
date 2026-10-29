---
id: SITE-02
title: "Start here"
description: "Choose the shortest path to a working Pling integration, or understand the model before writing code."
status: drafted
release: 0.1
prereq: ""
locale: en
---

# Start here

Pling is a capability layer for web applications. It gives an agent a defined set of operations that your application already knows how to perform. The agent does not scan the page and guess which button to press; it chooses from actions your team has declared.

Pling does not replace Vue, React, the DOM, or your backend. It adds a contract between the page and the agent, and a runtime that executes declared actions through the page's existing behaviour.

## Start with a framework

**Vue 3** — [Quick start: add Pling to a Vue app](/vue/quick-start-add-pling-to-a-vue-app)  
Add the plugin, declare the controls for one task, and mount an assistant on a working Todo page.

**React** — [Quick start: add Pling to a React app](/react/quick-start-add-pling-to-a-react-app)  
Install the provider, declare one action, and mount the assistant in your React application.

If you want to see the interaction before installing anything, open the [live examples](/examples/).

## What you need

Both quick starts assume:

- a Vue 3 or React application;
- Node.js 20 or newer for the tutorial tooling;
- a model endpoint that accepts requests in the OpenAI-compatible chat format.

During local development, the page may call the model endpoint directly. In production, model traffic should pass through your own server or gateway so that credentials and policy remain outside the browser.

Pling does not include a hosted model or a fixed model provider. The application decides which endpoint to use and how requests are authenticated.
