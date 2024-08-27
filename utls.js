export function bytesToDecimal(byteArray) {
    // Create an ArrayBuffer and copy the bytes to it
    const buffer = new ArrayBuffer(byteArray.length);
    const dataView = new DataView(buffer);

    // Copy the bytes to the buffer
    byteArray.forEach((byte, index) => {
        dataView.setUint8(index, byte);
    });

    // Read the 32-bit integer value from the DataView
    const decimalNumber = dataView.getUint32(0, true);

    return decimalNumber;
}

export async function send(writer, pkt) {
    await writer.ready;
    // console.log("writer is ready to write");
    await writer.write(pkt);
    // console.log("packet written..");
    await writer.ready
    // console.log("releasing the writer lock");
    writer.releaseLock()
    // console.log("writer lock released..");
}

export async function allSend(writable, pkt) {
    const buffer = new Uint8Array(pkt.length + 4)
    const pktLen = decimalToBytes(pkt.length)
    buffer.set(pktLen, 0)
    buffer.set(pkt, 4)
    // console.log("got packet to write, buffer:", buffer, "pkt length", pkt.length, "pktLen:", pktLen);
    let chunkSize = 2048
    if (buffer.length > chunkSize) {
        // Send the message in chunks of 1024 bytes
        for (let i = 0; i < buffer.length; i += chunkSize) {
            let end = i + chunkSize
            if (end > buffer.length) {
                end = buffer.length
            }
            const chunk = buffer.slice(i, end)
            // console.debug("sending chunk of size:", chunk.length, "from:", i, "to:", end);
            const writer = writable.getWriter()
            await send(writer, chunk)
        }
    } else {
        const writer = writable.getWriter()
        await send(writer, buffer)
    }
}

export function decimalToBytes(decimalNumber) {
    // Create a buffer with enough space to store the 32-bit integer
    const buffer = new ArrayBuffer(4);

    // Create a DataView to work with the buffer
    const dataView = new DataView(buffer);

    // Set the 32-bit integer value in little-endian format
    dataView.setUint32(0, decimalNumber, true);

    // Extract the bytes from the DataView
    const byteArray = new Uint8Array(buffer);

    return byteArray;
}