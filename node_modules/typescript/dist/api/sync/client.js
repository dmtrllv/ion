import { configureFileSystemCallbacks, encodeFileSystemCallbackResult, } from "../fsCallbacks.js";
import { getAPIProcessArgs, isSpawnOptions, resolveExePath, } from "../options.js";
import { SyncRpcChannel } from "../syncChannel.js";
import { combineTimingInfo, disabledTimingInfo, TimingCollector, } from "../timing.js";
import { TimingDump } from "../timingDump.js";
export class Client {
    channel;
    encoder = new TextEncoder();
    timing;
    timingDump;
    closed = false;
    maxResponseBytesPerPage;
    constructor(options) {
        if (!isSpawnOptions(options)) {
            throw new Error("Socket connections are not yet supported in the sync client");
        }
        this.timingDump = TimingDump.fromEnvironment("sync", "spawn");
        if (this.timingDump) {
            options = { ...options, collectTiming: true };
        }
        const args = getAPIProcessArgs(options, false);
        this.maxResponseBytesPerPage = options.maxResponseBytesPerPage;
        const fsConfiguration = configureFileSystemCallbacks(options.fs);
        if (fsConfiguration.arguments.length > 0) {
            args.push(`--callbacks=${fsConfiguration.arguments.join(",")}`);
        }
        const collectTiming = options.collectTiming ?? false;
        if (collectTiming) {
            this.timing = new TimingCollector();
        }
        const channel = new SyncRpcChannel(resolveExePath(options), args, collectTiming);
        this.channel = channel;
        if (options.fs) {
            for (const name of fsConfiguration.callbackNames) {
                if (name === "writeFile") {
                    const callback = options.fs.writeFile;
                    if (typeof callback !== "function")
                        throw new Error("Invalid writeFile callback configuration");
                    channel.registerCallback(name, (_, arg) => {
                        const { path, data } = JSON.parse(arg);
                        return JSON.stringify(encodeFileSystemCallbackResult(name, callback(path, data)));
                    });
                    continue;
                }
                const callback = options.fs[name];
                if (typeof callback !== "function")
                    throw new Error(`Invalid ${name} callback configuration`);
                channel.registerCallback(name, (_, arg) => {
                    return JSON.stringify(encodeFileSystemCallbackResult(name, callback(JSON.parse(arg))));
                });
            }
        }
    }
    apiRequest(method, params) {
        const encodedPayload = JSON.stringify(params);
        const start = performance.now();
        const result = this.channel.requestSync(method, encodedPayload);
        this.recordTiming(method, start);
        if (result.length) {
            return JSON.parse(result);
        }
        return undefined;
    }
    registerCallback(name, callback) {
        this.channel.registerCallback(name, (_, payload) => JSON.stringify(callback(JSON.parse(payload))) ?? "");
        return () => this.channel.unregisterCallback(name);
    }
    batchRequests(requests) {
        const params = { requests };
        if (this.maxResponseBytesPerPage !== undefined) {
            params.maxResponseBytesPerPage = this.maxResponseBytesPerPage;
        }
        const response = this.apiRequest("batchRequests", params);
        let responses = response.responses;
        let continuationToken = response.continuationToken;
        while (continuationToken) {
            const pageParams = {
                requests: [],
                continuationToken,
            };
            if (this.maxResponseBytesPerPage !== undefined) {
                pageParams.maxResponseBytesPerPage = this.maxResponseBytesPerPage;
            }
            const page = this.apiRequest("batchRequests", pageParams);
            if (page.responses.length < 200) {
                responses.push(...page.responses);
            }
            else {
                // If the number of responses is approaching the max argument length, we need to concat instead of push
                responses = responses.concat(page.responses);
            }
            continuationToken = page.continuationToken;
        }
        return { responses };
    }
    apiRequestBinary(method, params) {
        const start = performance.now();
        const result = this.channel.requestBinarySync(method, this.encoder.encode(JSON.stringify(params)));
        this.recordTiming(method, start);
        if (result.length === 0)
            return undefined;
        return result;
    }
    echo(payload) {
        return this.channel.requestSync("echo", payload);
    }
    echoBinary(payload) {
        return this.channel.requestBinarySync("echo", payload);
    }
    /**
     * Returns a combined timing snapshot: client-measured round-trip and byte
     * counts folded together with the server's own per-request processing time
     * (fetched via a getServerTiming request) and estimated transport overhead.
     */
    getTimingInfo() {
        if (!this.timing) {
            return disabledTimingInfo();
        }
        const local = this.timing.getInfo();
        // requestSync bypasses recordTiming, so this query does not pollute the
        // client-side collector.
        const result = this.channel.requestSync("getServerTiming", "");
        return combineTimingInfo(local, JSON.parse(result));
    }
    resetTimingInfo() {
        if (!this.timing)
            return;
        this.timing.reset();
        // Keep the server's collection in sync so combined totals stay meaningful.
        this.channel.requestSync("resetServerTiming", "");
    }
    /**
     * Returns the timing collector that per-node materialization is reported
     * into, or undefined when timing collection is disabled. The returned
     * collector is the same one folded into {@link getTimingInfo}, so
     * materialization totals surface alongside request timings.
     */
    getTimingCollector() {
        return this.timing;
    }
    recordTiming(method, start) {
        if (!this.timing)
            return;
        this.timing.record({
            method,
            roundTripMs: performance.now() - start,
            bytesSent: this.channel.lastBytesSent,
            bytesReceived: this.channel.lastBytesReceived,
        });
    }
    close() {
        if (this.closed)
            return;
        this.closed = true;
        try {
            if (this.timingDump && this.timing) {
                const local = this.timing.getInfo();
                let server;
                let serverTimingError;
                try {
                    server = JSON.parse(this.channel.requestSync("getServerTiming", ""));
                }
                catch (error) {
                    serverTimingError = String(error);
                }
                this.timingDump.write(local, server, serverTimingError);
            }
        }
        finally {
            this.channel.close();
        }
    }
}
//# sourceMappingURL=client.js.map