#!/bin/bash
# Opens the Practice App TV View in Chrome kiosk mode (full screen, no address bar/tabs).
# Double-click this file to launch. To exit kiosk mode, press Cmd+Q to quit Chrome
# (or Option+Cmd+Esc to force quit if needed).

open -n -a "Google Chrome" --args --kiosk "https://delcar-debug.github.io/Women-s-Site/practice-app/index.html?tv=team-board"
