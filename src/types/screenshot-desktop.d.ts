declare module 'screenshot-desktop' {
  interface Options {
    format?: 'png' | 'jpg';
    screen?: number | string;
  }
  function screenshot(opts?: Options): Promise<Buffer>;
  export default screenshot;
}