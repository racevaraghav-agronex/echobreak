import React from "react";

export default class MapErrorBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <div className="absolute inset-0 grid place-items-center bg-slate-100 p-6 text-center text-sm text-slate-600">Map is temporarily unavailable. Search and navigation controls are still available.</div>;
    }
    return this.props.children;
  }
}