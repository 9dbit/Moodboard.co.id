import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchPinterest, isPinterestBoardUrl, isPinterestShortUrl, isPublicImportAddress, parsePinterestUrl, pinterestImageCandidates, validatePublicReferenceUrl } from "../server/import-network";
test("Pinterest links validate the URL origin rather than a substring in a path", () => {
    for (const bad of ["http://www.pinterest.com/designer/board/", "https://pinterest.com.attacker.example/designer/board/", "https://example.com/pinterest.com/designer/board/", "https://pinterest.com@127.0.0.1/designer/board/", "https://www.pinterest.com:444/designer/board/", "https://www.pinterest.com./designer/board/", "https://127.0.0.1/pin.it/x"]) {
        assert.throws(() => parsePinterestUrl(bad));
        assert.equal(isPinterestBoardUrl(bad), false);
    }
    assert.equal(isPinterestBoardUrl("https://id.pinterest.com/designer/materials/"), true);
    assert.equal(isPinterestBoardUrl("https://www.pinterest.co.uk/designer/materials/"), true);
    assert.equal(isPinterestBoardUrl("https://www.pinterest.com/pin/123456/"), false);
    assert.equal(isPinterestBoardUrl("https://www.pinterest.com/resource/BoardFeedResource/get/"), false);
    assert.equal(isPinterestShortUrl("https://pin.it/abcdef"), true);
    assert.equal(isPinterestShortUrl("https://example.com/pin.it/abcdef"), false);
});
test("import networking rejects local, special-use, mapped and documentation IP ranges", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.5.1", "169.254.169.254", "100.100.100.100", "0.0.0.0", "198.18.0.1", "192.0.2.1", "198.51.100.1", "203.0.113.1", "224.0.0.1", "255.255.255.255", "::1", "::", "::ffff:127.0.0.1", "::ffff:a00:1", "fd00::1", "fe80::1", "2001:db8::1", "2002:a00:1::1"]) {
        assert.equal(isPublicImportAddress(ip), false, ip);
    }
    for (const ip of ["8.8.8.8", "151.101.0.84", "2001:4860:4860::8888", "2606:4700:4700::1111"])
        assert.equal(isPublicImportAddress(ip), true, ip);
});
const publicLookup = async () => [{ address: "151.101.0.84", family: 4 }];
test("DNS is validated for every redirect and private destinations are never fetched", async () => {
    let calls = 0;
    await assert.rejects(fetchPinterest("https://pin.it/fixture", {}, { lookup: async (host) => host === "pin.it" ? publicLookup() : [{ address: "127.0.0.1", family: 4 }], transport: async () => { calls++; return new Response(null, { status: 302, headers: { Location: "https://www.pinterest.com/user/board/" } }) as any; } }), /public address/);
    assert.equal(calls, 1);
    calls = 0;
    await assert.rejects(fetchPinterest("https://www.pinterest.com/user/board/", {}, { lookup: async () => [{ address: "151.101.0.84", family: 4 }, { address: "10.0.0.1", family: 4 }], transport: async () => { calls++; throw Error("must not fetch"); } }), /public address/);
    assert.equal(calls, 0);
});
test("redirects cannot escape Pinterest and cookies do not cross allowed origins", async () => {
    const sent: Array<{
        url: string;
        cookie: string | null;
        redirect: unknown;
    }> = [];
    const r = await fetchPinterest("https://pin.it/fixture", { method: "HEAD", headers: { Cookie: "private=fixture" } }, { lookup: publicLookup, transport: async (url, init) => {
            sent.push({ url: String(url), cookie: new Headers(init?.headers as any).get("cookie"), redirect: init?.redirect });
            return (sent.length === 1 ? new Response(null, { status: 302, headers: { location: "https://www.pinterest.com/designer/board/" } }) : new Response(null, { status: 200 })) as any;
        } });
    assert.equal(r.url, "https://www.pinterest.com/designer/board/");
    assert.equal(sent[0].cookie, "private=fixture");
    assert.equal(sent[1].cookie, null);
    assert.ok(sent.every(x => x.redirect === "manual"));
    await assert.rejects(fetchPinterest("https://pin.it/fixture", {}, { lookup: publicLookup, transport: async () => new Response(null, { status: 302, headers: { Location: "https://attacker.example/" } }) as any }), /Only HTTPS Pinterest/);
});
test("response size limits apply to streamed bodies and canceled requests do not resolve DNS", async () => {
    await assert.rejects(fetchPinterest("https://www.pinterest.com/user/board/", {}, { lookup: publicLookup, maxBytes: 8, transport: async () => new Response("123456789") as any }), /download limit/);
    await assert.rejects(fetchPinterest("https://www.pinterest.com/user/board/", {}, { lookup: publicLookup, maxBytes: 8, transport: async () => new Response("", { headers: { "content-length": "9" } }) as any }), /download limit/);
    const aborted = AbortSignal.abort();
    let lookedUp = false;
    await assert.rejects(fetchPinterest("https://www.pinterest.com/user/board/", {}, { signal: aborted, lookup: async () => { lookedUp = true; return publicLookup(); } }));
    assert.equal(lookedUp, false);
});
test("generic reference links require public HTTPS addresses", async () => {
    assert.equal((await validatePublicReferenceUrl("https://images.example/image.png#x", publicLookup)).href, "https://images.example/image.png");
    await assert.rejects(validatePublicReferenceUrl("http://images.example/image.png", publicLookup));
    await assert.rejects(validatePublicReferenceUrl("https://images.example/image.png", async () => [{ address: "::ffff:127.0.0.1", family: 6 }]), /public address/);
});
test("single-pin recovery does not trust source hostnames embedded inside another URL", () => {
    for (const raw of ["http://127.0.0.1/i.pinimg.com/originals/a.jpg", "https://attacker.example/i.pinimg.com/736x/a.jpg", "https://i.pinimg.com.attacker.example/736x/a.jpg", "https://i.pinimg.com@127.0.0.1/736x/a.jpg", "https://i.pinimg.com:444/736x/a.jpg", "/objects/uploads/private-fixture"])
        assert.deepEqual(pinterestImageCandidates(raw), []);
    const valid = pinterestImageCandidates("https://i.pinimg.com/736x/aa/bb/fixture.jpg");
    assert.ok(valid.includes("https://i.pinimg.com/originals/aa/bb/fixture.jpg"));
    assert.equal(valid.at(-1), "https://i.pinimg.com/736x/aa/bb/fixture.jpg");
});
