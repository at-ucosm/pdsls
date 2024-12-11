import { createResource, createSignal, Show, type Component } from "solid-js";
import { CredentialManager, XRPC } from "@atcute/client";
import { ComAtprotoRepoListRecords } from "@atcute/client/lexicons";
import { A, query, useParams } from "@solidjs/router";
import { resolvePDS } from "../utils/api.js";
import * as TID from "@atcute/tid";
import { resolveHandle } from "@atcute/oauth-browser-client";
import { JSONValue } from "../components/json.jsx";

const CollectionView: Component = () => {
  const params = useParams();
  const [cursor, setCursor] = createSignal<string>();
  const [records, setRecords] =
    createSignal<ComAtprotoRepoListRecords.Record[]>();
  const [filter, setFilter] = createSignal<string>();
  let did = params.repo;
  let pds: string;
  let rpc: XRPC;

  const listRecords = query(
    (did: string, collection: string, cursor: string | undefined) =>
      rpc.get("com.atproto.repo.listRecords", {
        params: {
          repo: did,
          collection: collection,
          limit: 100,
          cursor: cursor,
        },
      }),
    "listRecords",
  );

  const fetchRecords = async () => {
    if (!did.startsWith("did:")) did = await resolveHandle(params.repo);
    if (!pds) pds = await resolvePDS(did);
    if (!rpc)
      rpc = new XRPC({ handler: new CredentialManager({ service: pds }) });
    const res = await listRecords(did, params.collection, cursor());
    setCursor(res.data.records.length < 100 ? undefined : res.data.cursor);
    setRecords(records()?.concat(res.data.records) ?? res.data.records);
    return res.data.records;
  };

  const [response, { refetch }] = createResource(fetchRecords);

  const getDateFromTimestamp = (timestamp: number) =>
    new Date(timestamp - new Date().getTimezoneOffset() * 60 * 1000)
      .toISOString()
      .split(".")[0]
      .replace("T", " ");

  return (
    <div class="flex flex-col items-center">
      <Show when={records() || response()}>
        <div class="mb-3 flex w-full justify-center gap-x-2">
          <input
            type="text"
            spellcheck={false}
            placeholder="Filter by substring"
            class="dark:bg-dark-100 rounded-lg border border-gray-400 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300"
            onInput={(e) => setFilter(e.currentTarget.value)}
          />
        </div>
        <div class="flex flex-col font-mono">
          {records()!
            .filter((rec) =>
              filter() ? JSON.stringify(rec.value).includes(filter()!) : true,
            )
            .map((record, index) => {
              const [hoveringIndex, setHoveringIndex] = createSignal<number>();
              const rkey = record.uri.split("/").pop()!;
              const timestamp =
                TID.validate(rkey) ?
                  TID.parse(rkey).timestamp / 1000
                : undefined;
              return (
                <A
                  href={`${rkey}`}
                  class="hover:bg-neutral-300 dark:hover:bg-neutral-700"
                  onmouseover={() => setHoveringIndex(index)}
                  onmouseleave={() => setHoveringIndex(undefined)}
                >
                  <span class="text-lightblue-500">{rkey}</span>
                  <Show when={timestamp && timestamp <= Date.now()}>
                    <span class="ml-2 text-xs text-neutral-500 dark:text-neutral-400">
                      {getDateFromTimestamp(timestamp!)}
                    </span>
                  </Show>
                  <Show when={hoveringIndex() === index}>
                    <span class="bg-dark-400 left-50% max-h-xl absolute z-[2] mt-4 block -translate-x-1/2 overflow-hidden rounded-md border p-2 text-xs">
                      <JSONValue
                        data={record.value as any}
                        repo={record.uri.split("/")[2]}
                      />
                    </span>
                  </Show>
                </A>
              );
            })}
        </div>
      </Show>
      <Show when={cursor()}>
        <button
          type="button"
          onclick={() => refetch()}
          class="dark:bg-dark-700 dark:hover:bg-dark-800 mt-1 rounded-lg border border-gray-400 bg-white px-2.5 py-1.5 text-sm font-bold hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300"
        >
          Load More
        </button>
      </Show>
    </div>
  );
};

export { CollectionView };
