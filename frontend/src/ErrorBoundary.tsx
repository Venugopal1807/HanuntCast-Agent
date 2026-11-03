import { Component, type ReactNode } from 'react';
import { diagnose } from './diagnostics';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { diagnose('render_failure', { stage: 'render' }); }

  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="recovery-screen" aria-labelledby="recovery-title">
      <p className="eyebrow">THE STORY IS STILL HERE</p>
      <h1 id="recovery-title">A light went out.</h1>
      <p>The experience could not display this scene. Return to the entrance to start a new story.</p>
      <p className="fine-print">Your previous story will reset. No microphone recordings or provider credentials are stored in this browser.</p>
      <button className="primary wide" onClick={() => this.setState({ failed: false })}>Return to the entrance <span aria-hidden="true">→</span></button>
    </main>;
  }
}
