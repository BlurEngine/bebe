export class HttpHeader {
    constructor(
        readonly key: string,
        readonly value: string,
    ) {}
}

export class HttpRequest {
    body = "";
    headers: HttpHeader[] = [];
    method: HttpRequestMethod = HttpRequestMethod.Get;
    timeout = 0;

    constructor(readonly uri: string) {}

    setBody(body: string): HttpRequest {
        this.body = body;
        return this;
    }

    setHeaders(headers: HttpHeader[]): HttpRequest {
        this.headers = headers;
        return this;
    }

    setMethod(method: HttpRequestMethod): HttpRequest {
        this.method = method;
        return this;
    }

    setTimeout(timeout: number): HttpRequest {
        this.timeout = timeout;
        return this;
    }
}

export enum HttpRequestMethod {
    Get = "GET",
    Post = "POST",
}

export const http = {
    async request(): Promise<{ status: number; body: string }> {
        return { status: 200, body: '{"ok":true}' };
    },
};
