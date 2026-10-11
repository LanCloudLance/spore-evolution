type Sample = {
  frame: number;
  simulation: number;
  render: number;
  publish: number;
  input?: number;
};
/** Local development diagnostics. No network, game-state access, rewards or player UI. */
export function createFrameMetrics(canvas: HTMLCanvasElement) {
  const samples: Sample[] = [],
    inputSamples: number[] = [];
  let lastReport = 0;
  const enabled = ['localhost', '127.0.0.1'].includes(location.hostname);
  return (sample: Sample, now: number) => {
    if (!enabled) return;
    samples.push(sample);
    if (samples.length > 240) samples.shift();
    if (sample.input !== undefined) {
      inputSamples.push(sample.input);
      if (inputSamples.length > 32) inputSamples.shift();
    }
    if (now - lastReport < 1500 || samples.length < 10) return;
    lastReport = now;
    const summary = (key: keyof Sample) => {
      const values = (
        key === 'input'
          ? [...inputSamples]
          : samples.flatMap((s) => (s[key] === undefined ? [] : [s[key]!]))
      ).sort((a, b) => a - b);
      return values.length
        ? {
            n: values.length,
            median: +values[Math.floor(values.length * 0.5)].toFixed(2),
            p95: +values[
              Math.min(values.length - 1, Math.floor(values.length * 0.95))
            ].toFixed(2),
          }
        : null;
    };
    canvas.dataset.frameMetrics = JSON.stringify({
      samples: samples.length,
      frame: summary('frame'),
      simulation: summary('simulation'),
      render: summary('render'),
      publish: summary('publish'),
      input: summary('input'),
    });
  };
}
