'use strict';
/**
 * stripe-webhook-listener.js
 *
 * Implements:
 *   - Express application with express.raw middleware
 *   - Signature verification on raw body (stripe.webhooks.constructEvent)
 *   - Dedupe by event.id, respond 2xx fast (res.json({received: true})), process async
 *   - Appends verified revenue events to Ledger
 */
const express = require('express');
require('dotenv').config();

function createWebhookServer({ stripe, ledger, secret, port = process.env.WEBHOOK_PORT || 4242, log = { info() {}, warn() {}, error() {} } }) {
  const app = express();
  const processedEvents = new Set();

  app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch (err) {
      log.warn('webhook signature verification failed', { error: err.message });
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Fast 2xx response
    res.json({ received: true });

    // Dedupe by event.id
    if (processedEvents.has(event.id)) {
      log.info('ignoring duplicate webhook event', { eventId: event.id });
      return;
    }
    processedEvents.add(event.id);

    // Process event async into ledger
    if (event.type === 'payment_intent.succeeded' || event.type === 'checkout.session.completed') {
      const obj = event.data.object;
      const amount = obj.amount_received || obj.amount_total || 0;
      const currency = obj.currency || 'usd';

      await ledger.append('revenue', {
        eventId: event.id,
        amount,
        currency,
        customerId: obj.customer || obj.customer_details?.email
      }, `evt:${event.id}`);
      log.info('recorded revenue from webhook', { eventId: event.id, amount, currency });
    }
  });

  const server = app.listen(port, '0.0.0.0', () => {
    log.info(`[Production Webhook Listener] Listening for real incoming customer transactions on port ${port}`);
  });

  return server;
}

module.exports = { createWebhookServer };
