# Accordis

Accordis is an interactive music theory workspace with a chord detector, scale library, and chord library.

## Features

- Detect mode: click keys or use MIDI input to detect chords in real time.
- Missing note detection: identify missing notes in chords.
- Audio playback: play chords and scales from the library or in detect mode.
- Notation controls: toggle between sharps and flats.
- Scale and chord library: explore a wide range of scales and chords with audio examples.

## Supported Content

- Chord definitions: 23 qualities (triads, suspended, 6th, 7th, altered 7th, add9, 9th, 6add9).
- Scale definitions: 16 scales (major/minor systems, pentatonic, blues, modes, symmetric).

## Tech Stack

- Next.js 16 (App Router)
- React 19 + TypeScript
- Tailwind CSS 4
- Tone.js (audio playback)
- Vitest + Testing Library

## Getting Started

```bash
npm install
npm run dev
