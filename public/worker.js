self.addEventListener('message', function (e) {
    const data = e.data;
    let transport;

    let addToEventLog = (msg, type = 'info') => {
        self.postMessage({
            cmd: 'event',
            type: type,
            msg: msg
        });
    }

    switch (data.cmd) {
        case 'connect':
            try {
                transport = new WebTransport(url, {
                    serverCertificateHashes: [
                        {
                            algorithm: 'sha-256',
                            value: new Uint8Array(fingerprint)
                        }
                    ]
                });
                addToEventLog('Initiating connection...');
            } catch (e) {
                addToEventLog('Failed to create connection object. ' + e, 'error');
                return;
            }
            break;
        case 'stop':
            self.postMessage('WORKER STOPPED: ' + data.msg);
            self.close(); // Terminates the worker.
            break;
        default:
            self.postMessage('Unknown command: ' + data.msg);
    };
}, false);