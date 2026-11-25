// A classic script also works on local file pages, where fetch cannot read a neighbouring GLB.
window.loadPackedSpecimen = async function (modelURL) {
  const file = new URL(modelURL, document.baseURI).pathname.split("/").pop();
  if (!/^(?:model-[0-4]|pod_0[1-5])\.glb$/.test(file) || typeof DecompressionStream !== "function") {
    throw Error("Use the original GLB");
  }
  if (location.protocol !== "file:") {
    const url = new URL("./assets/specimens/" + file + ".gz", document.baseURI);
    const response = await fetch(url);
    if (!response.ok) throw Error("HTTP " + response.status);
    const bytes = new Uint8Array(await response.arrayBuffer());
    // Some hosts transparently decode .gz. Accept both forms.
    if (bytes[0] === 0x67 && bytes[1] === 0x6c) return bytes.buffer;
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Response(stream).arrayBuffer();
  }
  const [ranges, encoded] = await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = new URL("./assets/specimens/" + file.replace(/\.glb$/, ".js"), document.baseURI);
    script.onload = () => {
      if (Array.isArray(script.specimen)) resolve(script.specimen);
      else reject(Error("Invalid packed specimen"));
      script.remove();
    };
    script.onerror = () => { script.remove(); reject(Error("Packed specimen unavailable")); };
    document.head.appendChild(script);
  });
  let compressed;
  if (typeof Uint8Array.fromBase64 === "function") {
    compressed = Uint8Array.fromBase64(encoded);
  } else {
    const binary = atob(encoded);
    compressed = new Uint8Array(binary.length);
    for (let i=0; i<binary.length; i++) compressed[i] = binary.charCodeAt(i);
  }
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  for (const [start, size, stride] of ranges) {
    const planes = bytes.slice(start, start + size);
    let read = 0;
    for (let column=0; column<stride; column++) {
      for (let i=column; i<size; i+=stride) bytes[start+i] = planes[read++];
    }
  }
  return bytes.buffer;
};
