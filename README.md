# ingest-worker

This Worker is custom infrastructure that I use to paper over gaps in Cloudflare
Workers' observability story.

There isn't an easy way to record metrics or logs and query them without having
to subscribe to third-party SaaS. Apart from being expensive, most of these nullify
the point of running services on the Edge by having to talk to a central server
where the SaaS is hosted.

### What

This Worker acts as a proxy to a VPS on [Hetzner](https://www.hetzner.com/) that
runs:

1. [InfluxDB](https://www.influxdata.com/) (a time-series database that I use
   for recording metrics)
2. [Telegraf](https://www.influxdata.com/time-series-platform/telegraf/) (a
   generic agent that I use to record metrics about the VPS itself and push them to
   InfluxDB. This Worker also talks to Telegraf instead of InfluxDB directly)
3. [Grafana Loki](https://grafana.com/docs/loki/latest/) (A log aggregation
   system that I use for recording logs)
4. [Grafana Tempo](https://grafana.com/docs/tempo/latest/) (A distributed
   tracing backend that I use for recording traces)

### Why

The idea is that any service of mine can push logs / metrics / traces from the
Edge with very low latency (as opposed to talking to the VPS directly, which may
be on the other side of the Earth). This Worker is then able to queue up these
requests and talk to the VPS, swallowing the latency cost of doing so.

The Worker exposes a simple HTTP-based API that tries to hide away the quirks of
InfluxDB & Loki. A generic interface like this means I do not have to think about
observability specifics in my service. It also means I can swap out any component
without having to re-deploy everything else.

### Workers-specific advantages

If the service is a Cloudflare Worker, it can bind to this Worker directly using
a Service binding (which can avoid a public Internet round-trip)

If the service is a Cloudflare Worker, it can also configure this Worker as a
Tail Consumer, which means persistent, structured logging is literally as simple
as doing a `console.log` in the service.

### Future

Configuration and maintenance of InfluxDB, Telegraf, Loki & Tempo are currently
done ad-hoc, manually by me. In the future I'd like to wrap all that up in
containers to make this setup portable.

If anyone reading this is interested in replicating this setup for themselves,
please reach out (or open an issue)!
