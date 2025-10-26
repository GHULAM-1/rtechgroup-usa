# DocuSign Integration Setup Guide

This document explains how to configure DocuSign eSignature integration for rental agreements.

## Overview

When a rental is created, the system automatically:
1. Generates a rental agreement document
2. Sends it to the customer via DocuSign for signature
3. Tracks the signing status in real-time
4. Automatically saves the signed document when completed
5. Displays all rental agreements in the customer's Documents tab

## Prerequisites

1. **DocuSign Developer Account**: Sign up at [https://developers.docusign.com/](https://developers.docusign.com/)
2. **Create an Integration Key**: Create an app in the DocuSign Admin panel to get your Integration Key
3. **Generate RSA Key Pair**: For JWT authentication (recommended for server-to-server)

## Environment Variables

Add the following environment variables to your Supabase Edge Functions configuration:

### Required Variables

```bash
# DocuSign API Configuration
DOCUSIGN_INTEGRATION_KEY=your-integration-key-here
DOCUSIGN_USER_ID=your-user-id-here
DOCUSIGN_ACCOUNT_ID=your-account-id-here
DOCUSIGN_PRIVATE_KEY=your-rsa-private-key-here

# DocuSign Environment (demo or production)
DOCUSIGN_BASE_URL=https://demo.docusign.net/restapi  # Use https://www.docusign.net/restapi for production

# Webhook Security
DOCUSIGN_WEBHOOK_SECRET=your-webhook-secret-here
```

### How to Set Environment Variables in Supabase

#### Via Supabase CLI:
```bash
supabase secrets set DOCUSIGN_INTEGRATION_KEY=your-integration-key-here
supabase secrets set DOCUSIGN_USER_ID=your-user-id-here
supabase secrets set DOCUSIGN_ACCOUNT_ID=your-account-id-here
supabase secrets set DOCUSIGN_PRIVATE_KEY="$(cat path/to/private.key)"
supabase secrets set DOCUSIGN_BASE_URL=https://demo.docusign.net/restapi
supabase secrets set DOCUSIGN_WEBHOOK_SECRET=your-webhook-secret-here
```

#### Via Supabase Dashboard:
1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions** → **Manage secrets**
3. Add each environment variable individually

## Getting Your DocuSign Credentials

### 1. Integration Key (Client ID)

1. Log in to [DocuSign Admin](https://admindemo.docusign.com/) (or production admin)
2. Go to **Apps and Keys**
3. Click **Add App and Integration Key**
4. Give it a name (e.g., "RTech Rental System")
5. Copy the **Integration Key** - this is your `DOCUSIGN_INTEGRATION_KEY`

### 2. User ID

1. In the same **Apps and Keys** section
2. Find your user information at the top
3. Copy the **API Username** (looks like a GUID) - this is your `DOCUSIGN_USER_ID`

### 3. Account ID

1. In DocuSign Admin, go to **Settings**
2. Look for **Account ID** (usually in the URL or account info)
3. Copy it - this is your `DOCUSIGN_ACCOUNT_ID`

### 4. RSA Private Key (for JWT Authentication)

1. In your app settings in DocuSign Admin
2. Scroll to **Authentication**
3. Click **Generate RSA**
4. Download the private key file
5. Copy the entire contents (including `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----`)
6. Set this as `DOCUSIGN_PRIVATE_KEY` (keep newlines intact)

### 5. Grant Consent (One-Time)

After configuring JWT authentication, you need to grant consent:

1. Visit this URL (replace `{INTEGRATION_KEY}` with your actual key):
   ```
   https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id={INTEGRATION_KEY}&redirect_uri=https://www.docusign.com
   ```
2. Log in with your DocuSign account
3. Click **Allow Access**

## Webhook Configuration

To receive real-time updates when documents are signed:

### 1. Set Up Webhook in DocuSign

1. Go to **Settings** → **Connect** → **Add Configuration**
2. Set the webhook URL to your Supabase function:
   ```
   https://your-project-id.supabase.co/functions/v1/docusign-webhook
   ```
3. Select events to monitor:
   - ✅ Envelope Sent
   - ✅ Envelope Delivered
   - ✅ Envelope Completed
   - ✅ Envelope Signed
   - ✅ Envelope Declined
   - ✅ Envelope Voided
4. Enable **Include HMAC Signature**
5. Copy the webhook secret and set it as `DOCUSIGN_WEBHOOK_SECRET`

### 2. Test Webhook

After deploying, test the webhook by:
1. Creating a test rental
2. Signing the document in DocuSign
3. Verify the status updates in your database

## Database Migration

Run the database migration to add DocuSign fields to the rentals table:

```bash
# If using Supabase CLI
supabase db push

# Or manually run the migration file:
# supabase/migrations/20251026000000_add_docusign_fields_to_rentals.sql
```

## Deploy Edge Functions

Deploy the DocuSign integration functions:

```bash
# Deploy envelope creation function
supabase functions deploy create-docusign-envelope

# Deploy webhook handler
supabase functions deploy docusign-webhook
```

## Production Considerations

### 1. Switch to Production Environment

When going live, update:
```bash
DOCUSIGN_BASE_URL=https://www.docusign.net/restapi
```

And use your production DocuSign account credentials.

### 2. PDF Generation

The current implementation uses basic text formatting. For production:
- Implement proper PDF generation using libraries like `pdfkit` or `pdfmake`
- Create professional rental agreement templates
- Include company logo, terms & conditions, etc.

### 3. Error Handling

- Monitor Edge Function logs for errors
- Set up alerts for failed envelope creation
- Implement retry logic for webhook failures

### 4. Security

- Keep private keys secure and never commit to version control
- Rotate webhook secrets periodically
- Use environment-specific credentials (dev/staging/production)

## Testing

### Manual Test Flow

1. Create a new rental in the system
2. Check that the rental record has a `docusign_envelope_id`
3. Verify the customer receives an email from DocuSign
4. Sign the document in DocuSign
5. Confirm the status updates in the Customer → Documents tab
6. Verify the signed PDF appears in customer documents

### Development/Sandbox Testing

Use DocuSign's demo environment (`account-d.docusign.com`) for testing without sending real emails.

## Troubleshooting

### Common Issues

**Issue**: "DocuSign credentials not configured"
- **Solution**: Verify all environment variables are set correctly in Supabase secrets

**Issue**: JWT authentication fails
- **Solution**: Ensure you've granted consent and the private key is formatted correctly (with newlines)

**Issue**: Webhook not receiving events
- **Solution**: Check webhook URL is accessible, verify HMAC signature validation

**Issue**: Envelope creation succeeds but status never updates
- **Solution**: Verify webhook is configured correctly in DocuSign Connect settings

## Support & Resources

- [DocuSign API Documentation](https://developers.docusign.com/docs/esign-rest-api/)
- [DocuSign JWT Authentication Guide](https://developers.docusign.com/platform/auth/jwt/)
- [DocuSign Connect (Webhooks) Guide](https://developers.docusign.com/platform/webhooks/)
- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)

## Current Implementation Status

✅ Database schema updated with DocuSign fields
✅ Edge Functions created for envelope creation and webhook handling
✅ Frontend integrated to send documents after rental creation
✅ Customer Documents tab displays rental agreements with signing status
⚠️ **TODO**: Implement production-grade PDF generation
⚠️ **TODO**: Complete JWT authentication implementation
⚠️ **TODO**: Add embedded signing UI option (optional)
