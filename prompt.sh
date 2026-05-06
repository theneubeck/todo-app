#!/bin/bash
PROMPT="$(cat AGENTS.md)\n\n---\n\n$1"
ollama run gemma4:2b "$PROMPT"
