# Demos and architectures

URL: https://developers.cloudflare.com/r2/demos/

import {
	ExternalResources,
	GlossaryTooltip,
	ResourcesBySelector,
} from "~/components";

Learn how you can use R2 within your existing application and architecture.

## Demos

Explore the following <GlossaryTooltip term="demo application">demo applications</GlossaryTooltip> for R2.

<ExternalResources type="apps" products={["R2"]} />

## Reference architectures

Explore the following <GlossaryTooltip term="reference architecture">reference architectures</GlossaryTooltip> that use R2:

<ResourcesBySelector
	types={[
		"reference-architecture",
		"design-guide",
		"reference-architecture-diagram",
	]}
	products={["R2"]}
/>

---

# Getting started

URL: https://developers.cloudflare.com/r2/get-started/

import { Render, PackageManagers } from "~/components";

Cloudflare R2 Storage allows developers to store large amounts of unstructured data without the costly egress bandwidth fees associated with typical cloud storage services.

<div style="position: relative; padding-top: 56.25%;">
	<iframe
		src="https://customer-6qw1mjlclhl2mqdy.cloudflarestream.com/c247ba8eb4b61355184867bec9e5c532/iframe?poster=https%3A%2F%2Fcustomer-6qw1mjlclhl2mqdy.cloudflarestream.com%2Fc247ba8eb4b61355184867bec9e5c532%2Fthumbnails%2Fthumbnail.jpg%3Ftime%3D%26height%3D600"
		style="border: none; position: absolute; top: 0; left: 0; height: 100%; width: 100%;"
		allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
		allowfullscreen="true"
	></iframe>
</div>

## 1. Install and authenticate Wrangler

:::note
Before you create your first bucket, you must purchase R2 from the Cloudflare dashboard.
:::

1. [Install Wrangler](/workers/wrangler/install-and-update/) within your project using npm and Node.js or Yarn.

<PackageManagers pkg="wrangler@latest" dev />

2. [Authenticate Wrangler](/workers/wrangler/commands/#login) to enable deployments to Cloudflare. When Wrangler automatically opens your browser to display Cloudflare's consent screen, select **Allow** to send the API Token to Wrangler.

```txt
wrangler login
```

## 2. Create a bucket

To create a new R2 bucket from the Cloudflare dashboard:

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com) and select **R2**.
2. Select **Create bucket**.
3. Enter a name for the bucket and select **Create bucket**.

## 3. Upload your first object

1. From the **R2** page in the dashboard, locate and select your bucket.
2. Select **Upload**.
3. Choose to either drag and drop your file into the upload area or **select from computer**.

You will receive a confirmation message after a successful upload.

## Bucket access options

Cloudflare provides multiple ways for developers to access their R2 buckets:

- [R2 Workers Binding API](/r2/api/workers/workers-api-usage/)
- [S3 API compatibility](/r2/api/s3/api/)
- [Public buckets](/r2/buckets/public-buckets/)

---

# Cloudflare R2

URL: https://developers.cloudflare.com/r2/

import {
	CardGrid,
	Description,
	Feature,
	LinkButton,
	LinkTitleCard,
	Plan,
	RelatedProduct,
} from "~/components";

<Description>

Object storage for all your data.

</Description>

Cloudflare R2 Storage allows developers to store large amounts of unstructured data without the costly egress bandwidth fees associated with typical cloud storage services.

You can use R2 for multiple scenarios, including but not limited to:

- Storage for cloud-native applications
- Cloud storage for web content
- Storage for podcast episodes
- Data lakes (analytics and big data)
- Cloud storage output for large batch processes, such as machine learning model artifacts or datasets

<LinkButton variant="primary" href="/r2/get-started/">
	Get started
</LinkButton>
<LinkButton variant="secondary" href="/r2/examples/">
	Browse the examples
</LinkButton>

---

## Features

<Feature header="Location Hints" href="/r2/reference/data-location/#location-hints">

Location Hints are optional parameters you can provide during bucket creation to indicate the primary geographical location you expect data will be accessed from.

</Feature>

<Feature header="CORS" href="/r2/buckets/cors/">

Configure CORS to interact with objects in your bucket and configure policies on your bucket.

</Feature>

<Feature header="Public buckets" href="/r2/buckets/public-buckets/">

Public buckets expose the contents of your R2 bucket directly to the Internet.

</Feature>

<Feature header="Bucket scoped tokens" href="/r2/api/tokens/">

Create bucket scoped tokens for granular control over who can access your data.

</Feature>

---

## Related products

<RelatedProduct header="Workers" href="/workers/" product="workers">

A [serverless](https://www.cloudflare.com/learning/serverless/what-is-serverless/) execution environment that allows you to create entirely new applications or augment existing ones without configuring or maintaining infrastructure.

</RelatedProduct>

<RelatedProduct header="Stream" href="/stream/" product="stream">

Upload, store, encode, and deliver live and on-demand video with one API, without configuring or maintaining infrastructure.

</RelatedProduct>

<RelatedProduct header="Images" href="/images/" product="images">

A suite of products tailored to your image-processing needs.

</RelatedProduct>

---

## More resources

<CardGrid>

<LinkTitleCard title="Pricing" href="/r2/pricing" icon="seti:shell">
	&#x20;Understand pricing for free and paid tier rates.
</LinkTitleCard>

<LinkTitleCard
	title="Discord"
	href="https://discord.cloudflare.com"
	icon="discord"
>
	&#x20;Ask questions, show off what you are building, and discuss the platform
	with other developers.
</LinkTitleCard>

<LinkTitleCard title="Twitter" href="https://x.com/cloudflaredev" icon="x.com">
	&#x20;Learn about product announcements, new tutorials, and what is new in
	Cloudflare Workers.
</LinkTitleCard>

</CardGrid>

---

# Pricing

URL: https://developers.cloudflare.com/r2/pricing/

import { InlineBadge } from "~/components";

R2 charges based on the total volume of data stored, along with two classes of operations on that data:

1. [Class A operations](#class-a-operations) which are more expensive and tend to mutate state.
2. [Class B operations](#class-b-operations) which tend to read existing state.

For the Infrequent Access storage class, [data retrieval](#data-retrieval) fees apply. There are no charges for egress bandwidth for any storage class.

All included usage is on a monthly basis.

:::note

To learn about potential cost savings from using R2, refer to the [R2 pricing calculator](https://r2-calculator.cloudflare.com/).

:::

## R2 pricing

|                                    | Standard storage         | Infrequent Access storage <InlineBadge preset="beta" /> |
| ---------------------------------- | ------------------------ | ------------------------------------------------------- |
| Storage                            | $0.015 / GB-month        | $0.01 / GB-month                                        |
| Class A Operations                 | $4.50 / million requests | $9.00 / million requests                                |
| Class B Operations                 | $0.36 / million requests | $0.90 / million requests                                |
| Data Retrieval (processing)        | None                     | $0.01 / GB                                              |
| Egress (data transfer to Internet) | Free [^1]                | Free [^1]                                               |

### Free tier

You can use the following amount of storage and operations each month for free. The free tier only applies to Standard storage.

|                                    | Free                        |
| ---------------------------------- | --------------------------- |
| Storage                            | 10 GB-month / month         |
| Class A Operations                 | 1 million requests / month  |
| Class B Operations                 | 10 million requests / month |
| Egress (data transfer to Internet) | Free [^1]                   |

### Storage usage

Storage is billed using gigabyte-month (GB-month) as the billing metric. A GB-month is calculated by averaging the _peak_ storage per day over a billing period (30 days).

For example:

- Storing 1 GB constantly for 30 days will be charged as 1 GB-month.
- Storing 3 GB constantly for 30 days will be charged as 3 GB-month.
- Storing 1 GB for 5 days, then 3 GB for the remaining 25 days will be charged as `1 GB * 5/30 month + 3 GB * 25/30 month = 2.66 GB-month`

For objects stored in Infrequent Access storage, you will be charged for the object for the minimum storage duration even if the object was deleted or moved before the duration specified.

### Class A operations

Class A Operations include `ListBuckets`, `PutBucket`, `ListObjects`, `PutObject`, `CopyObject`, `CompleteMultipartUpload`, `CreateMultipartUpload`, `LifecycleStorageTierTransition`, `ListMultipartUploads`, `UploadPart`, `UploadPartCopy`, `ListParts`, `PutBucketEncryption`, `PutBucketCors` and `PutBucketLifecycleConfiguration`.

### Class B operations

Class B Operations include `HeadBucket`, `HeadObject`, `GetObject`, `UsageSummary`, `GetBucketEncryption`, `GetBucketLocation`, `GetBucketCors` and `GetBucketLifecycleConfiguration`.

### Free operations

Free operations include `DeleteObject`, `DeleteBucket` and `AbortMultipartUpload`.

### Data retrieval

Data retrieval fees apply when you access or retrieve data from the Infrequent Access storage class. This includes any time objects are read or copied.

### Minimum storage duration

For objects stored in Infrequent Access storage, you will be charged for the object for the minimum storage duration even if the object was deleted, moved, or replaced before the specified duration.

| Storage class                                          | Minimum storage duration |
| ------------------------------------------------------ | ------------------------ |
| Standard storage                                       | None                     |
| Infrequent Access storage<InlineBadge preset="beta" /> | 30 days                  |

## R2 Data Catalog pricing

R2 Data Catalog is in **public beta**, and any developer with an [R2 subscription](/r2/pricing/) can start using it. Currently, outside of standard R2 storage and operations, you will not be billed for your use of R2 Data Catalog. We will provide at least 30 days' notice before we make any changes or start charging for usage.

To learn more about our thinking on future pricing, refer to the [R2 Data Catalog announcement blog](https://blog.cloudflare.com/r2-data-catalog-public-beta).

## Data migration pricing

### Super Slurper

Super Slurper is free to use. You are only charged for the Class A operations that Super Slurper makes to your R2 bucket. Objects with sizes < 100MiB are uploaded to R2 in a single Class A operation. Larger objects use multipart uploads to increase transfer success rates and will perform multiple Class A operations. Note that your source bucket might incur additional charges as Super Slurper copies objects over to R2.

Once migration completes, you are charged for storage & Class A/B operations as described in previous sections.

### Sippy

Sippy is free to use. You are only charged for the operations Sippy makes to your R2 bucket. If a requested object is not present in R2, Sippy will copy it over from your source bucket. Objects with sizes < 200MiB are uploaded to R2 in a single Class A operation. Larger objects use multipart uploads to increase transfer success rates, and will perform multiple Class A operations. Note that your source bucket might incur additional charges as Sippy copies objects over to R2.

As objects are migrated to R2, they are served from R2, and you are charged for storage & Class A/B operations as described in previous sections.

## Pricing calculator

To learn about potential cost savings from using R2, refer to the [R2 pricing calculator](https://r2-calculator.cloudflare.com/).

## R2 billing examples

### Data storage example 1

If a user writes 1,000 objects in R2 for 1 month with an average size of 1 GB and requests each 1,000 times per month, the estimated cost for the month would be:

|                    | Usage                                       | Free Tier    | Billable Quantity | Price      |
| ------------------ | ------------------------------------------- | ------------ | ----------------- | ---------- |
| Class B Operations | (1,000 objects) \* (1,000 reads per object) | 10 million   | 0                 | $0.00      |
| Class A Operations | (1,000 objects) \* (1 write per object)     | 1 million    | 0                 | $0.00      |
| Storage            | (1,000 objects) \* (1 GB per object)        | 10 GB-months | 990 GB-months     | $14.85     |
| **TOTAL**          |                                             |              |                   | **$14.85** |
|                    |                                             |              |                   |            |

### Data storage example 2

If a user writes 10 objects in R2 for 1 month with an average size of 1 GB and requests 1,000 times per month, the estimated cost for the month would be:

|                    | Usage                                       | Free Tier    | Billable Quantity | Price     |
| ------------------ | ------------------------------------------- | ------------ | ----------------- | --------- |
| Class B Operations | (1,000 objects) \* (1,000 reads per object) | 10 million   | 0                 | $0.00     |
| Class A Operations | (1,000 objects) \* (1 write per object)     | 1 million    | 0                 | $0.00     |
| Storage            | (10 objects) \* (1 GB per object)           | 10 GB-months | 0                 | $0.00     |
| **TOTAL**          |                                             |              |                   | **$0.00** |
|                    |                                             |              |                   |           |

### Asset hosting

If a user writes 100,000 files with an average size of 100 KB object and reads 10,000,000 objects per day, the estimated cost in a month would be:

|                    | Usage                                   | Free Tier    | Billable Quantity | Price       |
| ------------------ | --------------------------------------- | ------------ | ----------------- | ----------- |
| Class B Operations | (10,000,000 reads per day) \* (30 days) | 10 million   | 290,000,000       | $104.40     |
| Class A Operations | (100,000 writes)                        | 1 million    | 0                 | $0.00       |
| Storage            | (100,000 objects) \* (100KB per object) | 10 GB-months | 0 GB-months       | $0.00       |
| **TOTAL**          |                                         |              |                   | **$104.40** |
|                    |                                         |              |                   |             |

## Cloudflare billing policy

To learn more about how usage is billed, refer to [Cloudflare Billing Policy](/billing/billing-policy/).

## Frequently asked questions

### Will I be charged for unauthorized requests to my R2 bucket?

No. You are not charged for operations when the caller does not have permission to make the request (HTTP 401 `Unauthorized` response status code).

[^1]: Egressing directly from R2, including via the [Workers API](/r2/api/workers/), [S3 API](/r2/api/s3/), and [`r2.dev` domains](/r2/buckets/public-buckets/#enable-managed-public-access) does not incur data transfer (egress) charges and is free. If you connect other metered services to an R2 bucket, you may be charged by those services.

---

# Videos

URL: https://developers.cloudflare.com/r2/video-tutorials/

import { CardGrid, LinkCard } from "~/components";

<CardGrid>
    <LinkCard
        title="Introduction to R2"
        description="Learn about Cloudflare R2, an object storage solution designed to handle your data and files efficiently. It is ideal for storing large media files, creating data lakes, or delivering web assets."
        href="/learning-paths/r2-intro/series/r2-1/"
    />
</CardGrid>

---

# API

URL: https://developers.cloudflare.com/r2/api/

import { DirectoryListing } from "~/components"

<DirectoryListing />

---

# Authentication

URL: https://developers.cloudflare.com/r2/api/tokens/

You can generate an API token to serve as the Access Key for usage with existing S3-compatible SDKs or XML APIs.

You must purchase R2 before you can generate an API token.

To create an API token:

1. In **Account Home**, select **R2**.
2. Under the **API** dropdown, select [**Manage API tokens**](https://dash.cloudflare.com/?to=/:account/r2/api-tokens).
3. Choose to create either:
   - **Create Account API token** - These tokens are tied to the Cloudflare account itself and can be used by any authorized system or user. Only users with the Super Administrator role can view or create them. These tokens remain valid until manually revoked.
   - **Create User API token** - These tokens are tied to your individual Cloudflare user. They inherit your personal permissions and become inactive if your user is removed from the account.
4. Under **Permissions**, choose a permission types for your token. Refer to [Permissions](#permissions) for information about each option.
5. (Optional) If you select the **Object Read and Write** or **Object Read** permissions, you can scope your token to a set of buckets.
6. Select **Create Account API token** or **Create User API token**.

After your token has been successfully created, review your **Secret Access Key** and **Access Key ID** values. These may often be referred to as Client Secret and Client ID, respectively.

:::caution

You will not be able to access your **Secret Access Key** again after this step. Copy and record both values to avoid losing them.

:::

You will also need to configure the `endpoint` in your S3 client to `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.

Find your [account ID in the Cloudflare dashboard](/fundamentals/account/find-account-and-zone-ids/).

Buckets created with jurisdictions must be accessed via jurisdiction-specific endpoints:

- European Union (EU): `https://<ACCOUNT_ID>.eu.r2.cloudflarestorage.com`
- FedRAMP: `https://<ACCOUNT_ID>.fedramp.r2.cloudflarestorage.com`

:::caution

Jurisdictional buckets can only be accessed via the corresponding jurisdictional endpoint. Most S3 clients will not let you configure multiple `endpoints`, so you'll generally have to initialize one client per jurisdiction.

:::

## Permissions

| Permission          | Description                                                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Admin Read & Write  | Allows the ability to create, list, and delete buckets, edit bucket configuration, read, write, and list objects, and read and write to data catalog tables and associated metadata. |
| Admin Read only     | Allows the ability to list buckets and view bucket configuration, read and list objects, and read from the data catalog tables and associated metadata.                              |
| Object Read & Write | Allows the ability to read, write, and list objects in specific buckets.                                                                                                             |
| Object Read only    | Allows the ability to read and list objects in specific buckets.                                                                                                                     |

:::note

Currently **Admin Read & Write** or **Admin Read only** permission is required to use [R2 Data Catalog](/r2/data-catalog/).

:::

## Create API tokens via API

You can create API tokens via the API and use them to generate corresponding Access Key ID and Secret Access Key values. To get started, refer to [Create API tokens via the API](/fundamentals/api/how-to/create-via-api/). Below are the specifics for R2.

### Access Policy

An Access Policy specifies what resources the token can access and the permissions it has.

#### Resources

There are two relevant resource types for R2: `Account` and `Bucket`. For more information on the Account resource type, refer to [Account](/fundamentals/api/how-to/create-via-api/#account).

##### Bucket

Include a set of R2 buckets or all buckets in an account.

A specific bucket is represented as:

```json
"com.cloudflare.edge.r2.bucket.<ACCOUNT_ID>_<JURISDICTION>_<BUCKET_NAME>": "*"
```

- `ACCOUNT_ID`: Refer to [Find zone and account IDs](/fundamentals/account/find-account-and-zone-ids/#find-account-id-workers-and-pages).
- `JURISDICTION`: The [jurisdiction](/r2/reference/data-location/#available-jurisdictions) where the R2 bucket lives. For buckets not created in a specific jurisdiction this value will be `default`.
- `BUCKET_NAME`: The name of the bucket your Access Policy applies to.

All buckets in an account are represented as:

```json
"com.cloudflare.api.account.<ACCOUNT_ID>": {
  "com.cloudflare.edge.r2.bucket.*": "*"
}
```

- `ACCOUNT_ID`: Refer to [Find zone and account IDs](/fundamentals/account/find-account-and-zone-ids/#find-account-id-workers-and-pages).

#### Permission groups

Determine what [permission groups](/fundamentals/api/how-to/create-via-api/#permission-groups) should be applied.

<table>
	<tbody>
		<th colspan="5" rowspan="1">
			Permission group
		</th>
		<th colspan="5" rowspan="1">
			Resource
		</th>
		<th colspan="5" rowspan="1">
			Description
		</th>
		<tr>
			<td colspan="5" rowspan="1">
				<code>Workers R2 Storage Write</code>
			</td>
			<td colspan="5" rowspan="1">
				Account
			</td>
			<td colspan="5" rowspan="1">
				Can create, delete, and list buckets, edit bucket configuration, and
				read, write, and list objects.
			</td>
		</tr>
		<tr>
			<td colspan="5" rowspan="1">
				<code>Workers R2 Storage Read</code>
			</td>
			<td colspan="5" rowspan="1">
				Account
			</td>
			<td colspan="5" rowspan="1">
				Can list buckets and view bucket configuration, and read and list
				objects.
			</td>
		</tr>
		<tr>
			<td colspan="5" rowspan="1">
				<code>Workers R2 Storage Bucket Item Write</code>
			</td>
			<td colspan="5" rowspan="1">
				Bucket
			</td>
			<td colspan="5" rowspan="1">
				Can read, write, and list objects in buckets.
			</td>
		</tr>
		<tr>
			<td colspan="5" rowspan="1">
				<code>Workers R2 Storage Bucket Item Read</code>
			</td>
			<td colspan="5" rowspan="1">
				Bucket
			</td>
			<td colspan="5" rowspan="1">
				Can read and list objects in buckets.
			</td>
		</tr>
		<tr>
			<td colspan="5" rowspan="1">
				<code>Workers R2 Data Catalog Write</code>
			</td>
			<td colspan="5" rowspan="1">
				Account
			</td>
			<td colspan="5" rowspan="1">
				Can read from and write to data catalogs. This permission allows
				access to the Iceberg REST catalog interface.
			</td>
		</tr>
		<tr>
			<td colspan="5" rowspan="1">
				<code>Workers R2 Data Catalog Read</code>
			</td>
			<td colspan="5" rowspan="1">
				Account
			</td>
			<td colspan="5" rowspan="1">
				Can read from data catalogs. This permission allows read-only
				access to the Iceberg REST catalog interface.
			</td>
		</tr>
	</tbody>
</table>

#### Example Access Policy

```json
[
	{
		"id": "f267e341f3dd4697bd3b9f71dd96247f",
		"effect": "allow",
		"resources": {
			"com.cloudflare.edge.r2.bucket.4793d734c0b8e484dfc37ec392b5fa8a_default_my-bucket": "*",
			"com.cloudflare.edge.r2.bucket.4793d734c0b8e484dfc37ec392b5fa8a_eu_my-eu-bucket": "*"
		},
		"permission_groups": [
			{
				"id": "6a018a9f2fc74eb6b293b0c548f38b39",
				"name": "Workers R2 Storage Bucket Item Read"
			}
		]
	}
]
```

### Get S3 API credentials from an API token

You can get the Access Key ID and Secret Access Key values from the response of the [Create Token](/api/resources/user/subresources/tokens/methods/create/) API:

- Access Key ID: The `id` of the API token.
- Secret Access Key: The SHA-256 hash of the API token `value`.

Refer to [Authenticate against R2 API using auth tokens](/r2/examples/authenticate-r2-auth-tokens/) for a tutorial with JavaScript, Python, and Go examples.

## Temporary access credentials

If you need to create temporary credentials for a bucket or a prefix/object within a bucket, you can use the [temp-access-credentials endpoint](/api/resources/r2/subresources/temporary_credentials/methods/create/) in the API. You will need an existing R2 token to pass in as the parent access key id. You can use the credentials from the API result for an S3-compatible request by setting the credential variables like so:

```
AWS_ACCESS_KEY_ID = <accessKeyId>
AWS_SECRET_ACCESS_KEY = <secretAccessKey>
AWS_SESSION_TOKEN = <sessionToken>
```

:::note

The temporary access key cannot have a permission that is higher than the parent access key. e.g. if the parent key is set to `Object Read Write`, the temporary access key could only have `Object Read Write` or `Object Read Only` permissions.

:::

---

# Bucket locks

URL: https://developers.cloudflare.com/r2/buckets/bucket-locks/

Bucket locks prevent the deletion and overwriting of objects in an R2 bucket for a specified period — or indefinitely. When enabled, bucket locks enforce retention policies on your objects, helping protect them from accidental or premature deletions.

## Get started with bucket locks

Before getting started, you will need:

- An existing R2 bucket. If you do not already have an existing R2 bucket, refer to [Create buckets](/r2/buckets/create-buckets/).
- (API only) An API token with [permissions](/r2/api/tokens/#permissions) to edit R2 bucket configuration.

### Enable bucket lock via dashboard

1. From the Cloudflare dashboard, select **R2** from the sidebar.
2. Select the bucket you would like to add bucket lock rule to.
3. Switch to the **Settings** tab, then scroll down to the **Bucket lock rules** card.
4. Select **Add rule** and enter the rule name, prefix, and retention period.
5. Select **Save changes**.

### Enable bucket lock via Wrangler

1. Install [`npm`](https://docs.npmjs.com/getting-started).
2. Install [Wrangler, the Developer Platform CLI](/workers/wrangler/install-and-update/).
3. Log in to Wrangler with the [`wrangler login` command](/workers/wrangler/commands/#login).
4. Add a bucket lock rule to your bucket by running the [`r2 bucket lock add` command](/workers/wrangler/commands/#r2-bucket-lock-add).

```sh
npx wrangler r2 bucket lock add <BUCKET_NAME> [OPTIONS]
```

Alternatively, you can set the entire bucket lock configuration for a bucket from a JSON file using the [`r2 bucket lock set` command](/workers/wrangler/commands/#r2-bucket-lock-set).

```sh
npx wrangler r2 bucket lock set <BUCKET_NAME> --file <FILE_PATH>
```

The JSON file should be in the format of the request body of the [put bucket lock configuration API](/api/resources/r2/subresources/buckets/subresources/locks/methods/update/).

### Enable bucket lock via API

For information about getting started with the Cloudflare API, refer to [Make API calls](/fundamentals/api/how-to/make-api-calls/). For information on required parameters and more examples of how to set bucket lock configuration, refer to the [API documentation](/api/resources/r2/subresources/buckets/subresources/locks/methods/update/).

Below is an example of setting a bucket lock configuration (a collection of rules):

```bash
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/r2/buckets/<BUCKET_NAME>/lock" \
    -H "Authorization: Bearer <API_TOKEN>" \
    -H "Content-Type: application/json" \
    -d '{
        "rules": [
            {
                "id": "lock-logs-7d",
                "enabled": true,
                "prefix": "logs/",
                "condition": {
                    "type": "Age",
                    "maxAgeSeconds": 604800
                }
            },
            {
                "id": "lock-images-indefinite",
                "enabled": true,
                "prefix": "images/",
                "condition": {
                    "type": "Indefinite"
                }
            }
        ]
    }'
```

This request creates two rules:

- `lock-logs-7d`: Objects under the `logs/` prefix are retained for 7 days (604800 seconds).
- `lock-images-indefinite`: Objects under the `images/` prefix are locked indefinitely.

:::note

If your bucket is setup with [jurisdictional restrictions](/r2/reference/data-location/#jurisdictional-restrictions), you will need to pass a `cf-r2-jurisdiction` request header with that jurisdiction. For example, `cf-r2-jurisdiction: eu`.

:::

## Get bucket lock rules for your R2 bucket

### Dashboard

1. From the Cloudflare dashboard, select **R2** from the sidebar.
2. Select the bucket you would like to add bucket lock rule to.
3. Switch to the **Settings** tab, then scroll down to the **Bucket lock rules** card.

### Wrangler

To list bucket lock rules, run the [`r2 bucket lock list` command](/workers/wrangler/commands/#r2-bucket-lock-list):

```sh
npx wrangler r2 bucket lock list <BUCKET_NAME>
```

### API

For more information on required parameters and examples of how to get bucket lock rules, refer to the [API documentation](/api/resources/r2/subresources/buckets/subresources/locks/methods/get/).

## Remove bucket lock rules from your R2 bucket

### Dashboard

1. From the Cloudflare dashboard, select **R2** from the sidebar.
2. Select the bucket you would like to add bucket lock rule to.
3. Switch to the **Settings** tab, then scroll down to the **Bucket lock rules** card.
4. Locate the rule you want to remove, select the `...` icon next to it, and then select **Delete**.

### Wrangler

To remove a bucket lock rule, run the [`r2 bucket lock remove` command](/workers/wrangler/commands/#r2-bucket-lock-remove):

```sh
npx wrangler r2 bucket lock remove <BUCKET_NAME> --id <RULE_ID>
```

### API

To remove bucket lock rules via API, exclude them from your updated configuration and use the [put bucket lock configuration API](/api/resources/r2/subresources/buckets/subresources/locks/methods/update/).

## Bucket lock rules

A bucket lock configuration can include up to 1,000 rules. Each rule specifies which objects it covers (via prefix) and how long those objects must remain locked. You can:

- Lock objects for a specific duration. For example, 90 days.
- Retain objects until a certain date. For example, until January 1, 2026.
- Keep objects locked indefinitely.

If multiple rules apply to the same prefix or object key, the strictest (longest) retention requirement takes precedence.

## Notes

- Rules without prefix apply to all objects in the bucket.
- Rules apply to both new and existing objects in the bucket.
- Bucket lock rules take precedence over [lifecycle rules](/r2/buckets/object-lifecycles/). For example, if a lifecycle rule attempts to delete an object at 30 days but a bucket lock rule requires it be retained for 90 days, the object will not be deleted until the 90-day requirement is met.

---

# Configure CORS

URL: https://developers.cloudflare.com/r2/buckets/cors/

[Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) is a standardized method that prevents domain X from accessing the resources of domain Y. It does so by using special headers in HTTP responses from domain Y, that allow your browser to verify that domain Y permits domain X to access these resources.

While CORS can help protect your data from malicious websites, CORS is also used to interact with objects in your bucket and configure policies on your bucket.

CORS is used when you interact with a bucket from a web browser, and you have two options:

**[Set a bucket to public:](#use-cors-with-a-public-bucket)** This option makes your bucket accessible on the Internet as read-only, which means anyone can request and load objects from your bucket in their browser or anywhere else. This option is ideal if your bucket contains images used in a public blog.

**[Presigned URLs:](#use-cors-with-a-presigned-url)** Allows anyone with access to the unique URL to perform specific actions on your bucket.

## Prerequisites

Before you configure CORS, you must have:

- An R2 bucket with at least one object. If you need to create a bucket, refer to [Create a public bucket](/r2/buckets/public-buckets/).
- A domain you can use to access the object. This can also be a `localhost`.
- (Optional) Access keys. An access key is only required when creating a presigned URL.

## Use CORS with a public bucket

[To use CORS with a public bucket](/r2/buckets/public-buckets/), ensure your bucket is set to allow public access.

Next, [add a CORS policy](#add-cors-policies-from-the-dashboard) to your bucket to allow the file to be shared.

## Use CORS with a presigned URL

Presigned URLs are an S3 concept that contain a special signature that encodes details of an S3 action, such as `GetObject` or `PutObject`. Presigned URLs are only used for authentication, which means they are generally safe to distribute publicly without revealing any secrets.

### Create a presigned URL

You will need a pair of S3-compatible credentials to use when you generate the presigned URL.

The example below shows how to generate a presigned `PutObject` URL using the [`@aws-sdk/client-s3`](https://www.npmjs.com/package/@aws-sdk/client-s3) package for JavaScript.

```js
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
const S3 = new S3Client({
	endpoint: "https://<account_id>.r2.cloudflarestorage.com",
	credentials: {
		accessKeyId: "<access_key_id>",
		secretAccessKey: "<access_key_secret>",
	},
	region: "auto",
});
const url = await getSignedUrl(
	S3,
	new PutObjectCommand({
		Bucket: bucket,
		Key: object,
	}),
	{
		expiresIn: 60 * 60 * 24 * 7, // 7d
	},
);
console.log(url);
```

### Test the presigned URL

Test the presigned URL by uploading an object using cURL. The example below would upload the `123` text to R2 with a `Content-Type` of `text/plain`.

```sh
curl --request PUT <URL> --header "Content-Type: text/plain" --data "123"
```

## Add CORS policies from the dashboard

1. From the Cloudflare dashboard, select **R2**.
2. Locate and select your bucket from the list.
3. From your bucket’s page, select **Settings**.
4. Under **CORS Policy**, select **Add CORS policy**.
5. From the **JSON** tab, manually enter or copy and paste your policy into the text box.
6. When you are done, select **Save**.

Your policy displays on the **Settings** page for your bucket.

## Response headers

The following fields in an R2 CORS policy map to HTTP response headers. These response headers are only returned when the incoming HTTP request is a valid CORS request.

| Field Name       | Description                                                                                                                                                                                                                                                                                                                                                           | Example                                                                                                                                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AllowedOrigins` | Specifies the value for the `Access-Control-Allow-Origin` header R2 sets when requesting objects in a bucket from a browser.                                                                                                                                                                                                                                          | If a website at `www.test.com` needs to access resources (e.g. fonts, scripts) on a [custom domain](/r2/buckets/public-buckets/#custom-domains) of `static.example.com`, you would set `https://www.test.com` as an `AllowedOrigin`. |
| `AllowedMethods` | Specifies the value for the `Access-Control-Allow-Methods` header R2 sets when requesting objects in a bucket from a browser.                                                                                                                                                                                                                                         | `GET`, `POST`, `PUT`                                                                                                                                                                                                                 |
| `AllowedHeaders` | Specifies the value for the `Access-Control-Allow-Headers` header R2 sets when requesting objects in this bucket from a browser.Cross-origin requests that include custom headers (e.g. `x-user-id`) should specify these headers as `AllowedHeaders`.                                                                                                                | `x-requested-by`, `User-Agent`                                                                                                                                                                                                       |
| `ExposeHeaders`  | Specifies the headers that can be exposed back, and accessed by, the JavaScript making the cross-origin request. If you need to access headers beyond the [safelisted response headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Expose-Headers#examples), such as `Content-Encoding` or `cf-cache-status`, you must specify it here. | `Content-Encoding`, `cf-cache-status`, `Date`                                                                                                                                                                                        |
| `MaxAgeSeconds`  | Specifies the amount of time (in seconds) browsers are allowed to cache CORS preflight responses. Browsers may limit this to 2 hours or less, even if the maximum value (86400) is specified.                                                                                                                                                                         | `3600`                                                                                                                                                                                                                               |

## Example

This example shows a CORS policy added for a bucket that contains the `Roboto-Light.ttf` object, which is a font file.

The `AllowedOrigins` specify the web server being used, and `localhost:3000` is the hostname where the web server is running. The `AllowedMethods` specify that only `GET` requests are allowed and can read objects in your bucket.

```json
[
	{
		"AllowedOrigins": ["http://localhost:3000"],
		"AllowedMethods": ["GET"]
	}
]
```

In general, a good strategy for making sure you have set the correct CORS rules is to look at the network request that is being blocked by your browser.

- Make sure the rule's `AllowedOrigins` includes the origin where the request is being made from. (like `http://localhost:3000` or `https://yourdomain.com`)
- Make sure the rule's `AllowedMethods` includes the blocked request's method.
- Make sure the rule's `AllowedHeaders` includes the blocked request's headers.

Also note that CORS rule propagation can, in rare cases, take up to 30 seconds.

## Common Issues

- Only a cross-origin request will include CORS response headers.
  - A cross-origin request is identified by the presence of an `Origin` HTTP request header, with the value of the `Origin` representing a valid, allowed origin as defined by the `AllowedOrigins` field of your CORS policy.
  - A request without an `Origin` HTTP request header will _not_ return any CORS response headers. Origin values must match exactly.
- The value(s) for `AllowedOrigins` in your CORS policy must be a valid [HTTP Origin header value](https://fetch.spec.whatwg.org/#origin-header). A valid `Origin` header does _not_ include a path component and must only be comprised of a `scheme://host[:port]` (where port is optional).
  - Valid `AllowedOrigins` value: `https://static.example.com` - includes the scheme and host. A port is optional and implied by the scheme.
  - Invalid `AllowedOrigins` value: `https://static.example.com/` or `https://static.example.com/fonts/Calibri.woff2` - incorrectly includes the path component.
- If you need to access specific header values via JavaScript on the origin page, such as when using a video player, ensure you set `Access-Control-Expose-Headers` correctly and include the headers your JavaScript needs access to, such as `Content-Length`.

---

# Create new buckets

URL: https://developers.cloudflare.com/r2/buckets/create-buckets/

You can create a bucket from the Cloudflare dashboard or using Wrangler.

:::note

Wrangler is [a command-line tool](/workers/wrangler/install-and-update/) for building with Cloudflare's developer products, including R2.

The R2 support in Wrangler allows you to manage buckets and perform basic operations against objects in your buckets. For more advanced use-cases, including bulk uploads or mirroring files from legacy object storage providers, we recommend [rclone](/r2/examples/rclone/) or an [S3-compatible](/r2/api/s3/) tool of your choice.

:::

## Bucket-Level Operations

Create a bucket with the [`r2 bucket create`](/workers/wrangler/commands/#r2-bucket-create) command:

```sh
wrangler r2 bucket create your-bucket-name
```

:::note

- Bucket names can only contain lowercase letters (a-z), numbers (0-9), and hyphens (-).
- Bucket names cannot begin or end with a hyphen.
- Bucket names can only be between 3-63 characters in length.

The placeholder text is only for the example.

:::

List buckets in the current account with the [`r2 bucket list`](/workers/wrangler/commands/#r2-bucket-list) command:

```sh
wrangler r2 bucket list
```

Delete a bucket with the [`r2 bucket delete`](/workers/wrangler/commands/#r2-bucket-delete) command. Note that the bucket must be empty and all objects must be deleted.

```sh
wrangler r2 bucket delete BUCKET_TO_DELETE
```

## Notes

- Bucket names and buckets are not public by default. To allow public access to a bucket, refer to [Public buckets](/r2/buckets/public-buckets/).
- For information on controlling access to your R2 bucket with Cloudflare Access, refer to [Protect an R2 Bucket with Cloudflare Access](/r2/tutorials/cloudflare-access/).
- Invalid (unauthorized) access attempts to private buckets do not incur R2 operations charges against that bucket. Refer to the [R2 pricing FAQ](/r2/pricing/#frequently-asked-questions) to understand what operations are billed vs. not billed.

---

# Event notifications

URL: https://developers.cloudflare.com/r2/buckets/event-notifications/

Event notifications send messages to your [queue](/queues/) when data in your R2 bucket changes. You can consume these messages with a [consumer Worker](/queues/reference/how-queues-works/#create-a-consumer-worker) or [pull over HTTP](/queues/configuration/pull-consumers/) from outside of Cloudflare Workers.

## Get started with event notifications

### Prerequisites

Before getting started, you will need:

- An existing R2 bucket. If you do not already have an existing R2 bucket, refer to [Create buckets](/r2/buckets/create-buckets/).
- An existing queue. If you do not already have a queue, refer to [Create a queue](/queues/get-started/#2-create-a-queue).
- A [consumer Worker](/queues/reference/how-queues-works/#create-a-consumer-worker) or [HTTP pull](/queues/configuration/pull-consumers/) enabled on your Queue.

### Enable event notifications via Dashboard

1. From the Cloudflare dashboard, select **R2** from the sidebar.
2. Select the bucket you'd like to add an event notification rule to.
3. Switch to the **Settings** tab, then scroll down to the **Event notifications** card.
4. Select **Add notification** and choose the queue you'd like to receive notifications and the [type of events](/r2/buckets/event-notifications/#event-types) that will trigger them.
5. Select **Add notification**.

### Enable event notifications via Wrangler

#### Set up Wrangler

To begin, install [`npm`](https://docs.npmjs.com/getting-started). Then [install Wrangler, the Developer Platform CLI](/workers/wrangler/install-and-update/).

#### Enable event notifications on your R2 bucket

Log in to Wrangler with the [`wrangler login` command](/workers/wrangler/commands/#login). Then add an [event notification rule](/r2/buckets/event-notifications/#event-notification-rules) to your bucket by running the [`r2 bucket notification create` command](/workers/wrangler/commands/#r2-bucket-notification-create).

```sh
npx wrangler r2 bucket notification create <BUCKET_NAME> --event-type <EVENT_TYPE> --queue <QUEUE_NAME>
```

To add filtering based on `prefix` or `suffix` use the `--prefix` or `--suffix` flag, respectively.

```sh
# Filter using prefix
$ npx wrangler r2 bucket notification create <BUCKET_NAME> --event-type <EVENT_TYPE> --queue <QUEUE_NAME> --prefix "<PREFIX_VALUE>"

# Filter using suffix
$ npx wrangler r2 bucket notification create <BUCKET_NAME> --event-type <EVENT_TYPE> --queue <QUEUE_NAME> --suffix "<SUFFIX_VALUE>"

# Filter using prefix and suffix. Both the conditions will be used for filtering
$ npx wrangler r2 bucket notification create <BUCKET_NAME> --event-type <EVENT_TYPE> --queue <QUEUE_NAME> --prefix "<PREFIX_VALUE>" --suffix "<SUFFIX_VALUE>"
```

For a more complete step-by-step example, refer to the [Log and store upload events in R2 with event notifications](/r2/tutorials/upload-logs-event-notifications/) example.

## Event notification rules

Event notification rules determine the [event types](/r2/buckets/event-notifications/#event-types) that trigger notifications and optionally enable filtering based on object `prefix` and `suffix`. You can have up to 100 event notification rules per R2 bucket.

## Event types

<table>
	<tbody>
		<th style="width:25%">Event type</th>
		<th style="width:50%">Description</th>
		<th style="width:25%">Trigger actions</th>
		<tr>
			<td>
				<code>object-create</code>
			</td>
			<td>
				Triggered when new objects are created or existing objects are
				overwritten.
			</td>
			<td>
				<ul>
					<li>
						<code>PutObject</code>
					</li>
					<li>
						<code>CopyObject</code>
					</li>
					<li>
						<code>CompleteMultipartUpload</code>
					</li>
				</ul>
			</td>
		</tr>
		<tr>
			<td>
				<code>object-delete</code>
			</td>
			<td>Triggered when an object is explicitly removed from the bucket.</td>
			<td>
				<ul>
					<li>
						<code>DeleteObject</code>
					</li>
					<li>
						<code>LifecycleDeletion</code>
					</li>
				</ul>
			</td>
		</tr>
	</tbody>
</table>

## Message format

Queue consumers receive notifications as [Messages](/queues/configuration/javascript-apis/#message). The following is an example of the body of a message that a consumer Worker will receive:

```json
{
	"account": "3f4b7e3dcab231cbfdaa90a6a28bd548",
	"action": "CopyObject",
	"bucket": "my-bucket",
	"object": {
		"key": "my-new-object",
		"size": 65536,
		"eTag": "c846ff7a18f28c2e262116d6e8719ef0"
	},
	"eventTime": "2024-05-24T19:36:44.379Z",
	"copySource": {
		"bucket": "my-bucket",
		"object": "my-original-object"
	}
}
```

### Properties

<table>
	<tbody>
		<th style="width:22%">Property</th>
		<th style="width:18%">Type</th>
		<th style="width:60%">Description</th>
		<tr>
			<td>
				<code>account</code>
			</td>
			<td>String</td>
			<td>The Cloudflare account ID that the event is associated with.</td>
		</tr>
		<tr>
			<td>
				<code>action</code>
			</td>
			<td>String</td>
			<td>
				The type of action that triggered the event notification. Example
				actions include: <code>PutObject</code>, <code>CopyObject</code>,{" "}
				<code>CompleteMultipartUpload</code>, <code>DeleteObject</code>.
			</td>
		</tr>
		<tr>
			<td>
				<code>bucket</code>
			</td>
			<td>String</td>
			<td>The name of the bucket where the event occurred.</td>
		</tr>
		<tr>
			<td>
				<code>object</code>
			</td>
			<td>Object</td>
			<td>
				A nested object containing details about the object involved in the
				event.
			</td>
		</tr>
		<tr>
			<td>
				<code>object.key</code>
			</td>
			<td>String</td>
			<td>The key (or name) of the object within the bucket.</td>
		</tr>
		<tr>
			<td>
				<code>object.size</code>
			</td>
			<td>Number</td>
			<td>
				The size of the object in bytes. Note: not present for object-delete
				events.
			</td>
		</tr>
		<tr>
			<td>
				<code>object.eTag</code>
			</td>
			<td>String</td>
			<td>
				The entity tag (eTag) of the object. Note: not present for object-delete
				events.
			</td>
		</tr>
		<tr>
			<td>
				<code>eventTime</code>
			</td>
			<td>String</td>
			<td>The time when the action that triggered the event occurred.</td>
		</tr>
		<tr>
			<td>
				<code>copySource</code>
			</td>
			<td>Object</td>
			<td>
				A nested object containing details about the source of a copied object.
				Note: only present for events triggered by <code>CopyObject</code>.
			</td>
		</tr>
		<tr>
			<td>
				<code>copySource.bucket</code>
			</td>
			<td>String</td>
			<td>The bucket that contained the source object.</td>
		</tr>
		<tr>
			<td>
				<code>copySource.object</code>
			</td>
			<td>String</td>
			<td>The name of the source object.</td>
		</tr>
	</tbody>
</table>

## Notes

- Queues [per-queue message throughput](/queues/platform/limits/) is currently 5,000 messages per second. If your workload produces more than 5,000 notifications per second, we recommend splitting notification rules across multiple queues.
- Rules without prefix/suffix apply to all objects in the bucket.
- Overlapping or conflicting rules that could trigger multiple notifications for the same event are not allowed. For example, if you have an `object-create` (or `PutObject` action) rule without a prefix and suffix, then adding another `object-create` (or `PutObject` action) rule with a prefix like `images/` could trigger more than one notification for a single upload, which is invalid.

---

# Buckets

URL: https://developers.cloudflare.com/r2/buckets/

import { DirectoryListing } from "~/components"

With object storage, all of your objects are stored in buckets. Buckets do not contain folders that group the individual files, but instead, buckets have a flat structure which simplifies the way you access and retrieve the objects in your bucket.

Learn more about bucket level operations from the items below.

<DirectoryListing />

---

# Object lifecycles

URL: https://developers.cloudflare.com/r2/buckets/object-lifecycles/

Object lifecycles determine the retention period of objects uploaded to your bucket and allow you to specify when objects should transition from Standard storage to Infrequent Access storage.

A lifecycle configuration is a collection of lifecycle rules that define actions to apply to objects during their lifetime.

For example, you can create an object lifecycle rule to delete objects after 90 days, or you can set a rule to transition objects to Infrequent Access storage after 30 days.

## Behavior

- Objects will typically be removed from a bucket within 24 hours of the `x-amz-expiration` value.
- When a lifecycle configuration is applied that deletes objects, newly uploaded objects' `x-amz-expiration` value immediately reflects the expiration based on the new rules, but existing objects may experience a delay. Most objects will be transitioned within 24 hours but may take longer depending on the number of objects in the bucket. While objects are being migrated, you may see old applied rules from the previous configuration.
- An object is no longer billable once it has been deleted.
- Buckets have a default lifecycle rule to expire multipart uploads seven days after initiation.
- When an object is transitioned from Standard storage to Infrequent Access storage, a [Class A operation](/r2/pricing/#class-a-operations) is incurred.
- When rules conflict and specify both a storage class transition and expire transition within a 24-hour period, the expire (or delete) lifecycle transition takes precedence over transitioning storage class.

## Configure lifecycle rules for your bucket

When you create an object lifecycle rule, you can specify which prefix you would like it to apply to.

- Note that object lifecycles currently has a 1000 rule maximum.
- Managing object lifecycles is a bucket-level action, and requires an API token with the [`Workers R2 Storage Write`](/r2/api/tokens/#permission-groups) permission group.

### Dashboard

1. From the Cloudflare dashboard, select **R2**.
2. Locate and select your bucket from the list.
3. From the bucket page, select **Settings**.
4. Under **Object lifecycle rules**, select **Add rule**.
5. Fill out the fields for the new rule.
6. When you are done, select **Add rule**.

### Wrangler

1. Install [`npm`](https://docs.npmjs.com/getting-started).
2. Install [Wrangler, the Developer Platform CLI](/workers/wrangler/install-and-update/).
3. Log in to Wrangler with the [`wrangler login` command](/workers/wrangler/commands/#login).
4. Add a lifecycle rule to your bucket by running the [`r2 bucket lifecycle add` command](/workers/wrangler/commands/#r2-bucket-lifecycle-add).

```sh
npx wrangler r2 bucket lifecycle add <BUCKET_NAME> [OPTIONS]
```

Alternatively you can set the entire lifecycle configuration for a bucket from a JSON file using the [`r2 bucket lifecycle set` command](/workers/wrangler/commands/#r2-bucket-lifecycle-set).

```sh
npx wrangler r2 bucket lifecycle set <BUCKET_NAME> --file <FILE_PATH>
```

The JSON file should be in the format of the request body of the [put object lifecycle configuration API](/api/resources/r2/subresources/buckets/subresources/lifecycle/methods/update/).

### S3 API

Below is an example of configuring a lifecycle configuration (a collection of lifecycle rules) with different sets of rules for different potential use cases.

```js title="Configure the S3 client to interact with R2"
const client = new S3({
	endpoint: "https://<account_id>.r2.cloudflarestorage.com",
	credentials: {
		accessKeyId: "<access_key_id>",
		secretAccessKey: "<access_key_secret>",
	},
	region: "auto",
});
```

```javascript title="Set the lifecycle configuration for a bucket"
await client
	.putBucketLifecycleConfiguration({
		Bucket: "testBucket",
		LifecycleConfiguration: {
			Rules: [
				// Example: deleting objects on a specific date
				// Delete 2019 documents in 2024
				{
					ID: "Delete 2019 Documents",
					Status: "Enabled",
					Filter: {
						Prefix: "2019/",
					},
					Expiration: {
						Date: new Date("2024-01-01"),
					},
				},
				// Example: transitioning objects to Infrequent Access storage by age
				// Transition objects older than 30 days to Infrequent Access storage
				{
					ID: "Transition Objects To Infrequent Access",
					Status: "Enabled",
					Transitions: [
						{
							Days: 30,
							StorageClass: "STANDARD_IA",
						},
					],
				},
				// Example: deleting objects by age
				// Delete logs older than 90 days
				{
					ID: "Delete Old Logs",
					Status: "Enabled",
					Filter: {
						Prefix: "logs/",
					},
					Expiration: {
						Days: 90,
					},
				},
				// Example: abort all incomplete multipart uploads after a week
				{
					ID: "Abort Incomplete Multipart Uploads",
					Status: "Enabled",
					AbortIncompleteMultipartUpload: {
						DaysAfterInitiation: 7,
					},
				},
				// Example: abort user multipart uploads after a day
				{
					ID: "Abort User Incomplete Multipart Uploads",
					Status: "Enabled",
					Filter: {
						Prefix: "useruploads/",
					},
					AbortIncompleteMultipartUpload: {
						// For uploads matching the prefix, this rule will take precedence
						// over the one above due to its earlier expiration.
						DaysAfterInitiation: 1,
					},
				},
			],
		},
	})
	.promise();
```

## Get lifecycle rules for your bucket

### Wrangler

To get the list of lifecycle rules associated with your bucket, run the [`r2 bucket lifecycle list` command](/workers/wrangler/commands/#r2-bucket-lifecycle-list).

```sh
npx wrangler r2 bucket lifecycle list <BUCKET_NAME>
```

### S3 API

```js
import S3 from "aws-sdk/clients/s3.js";

// Configure the S3 client to talk to R2.
const client = new S3({
	endpoint: "https://<account_id>.r2.cloudflarestorage.com",
	credentials: {
		accessKeyId: "<access_key_id>",
		secretAccessKey: "<access_key_secret>",
	},
	region: "auto",
});

// Get lifecycle configuration for bucket
console.log(
	await client
		.getBucketLifecycleConfiguration({
			Bucket: "bucketName",
		})
		.promise(),
);
```

## Delete lifecycle rules from your bucket

### Dashboard

1. From the Cloudflare dashboard, select **R2**.
2. Locate and select your bucket from the list.
3. From the bucket page, select **Settings**.
4. Under **Object lifecycle rules**, select the rules you would like to delete.
5. When you are done, select **Delete rule(s)**.

### Wrangler

To remove a specific lifecycle rule from your bucket, run the [`r2 bucket lifecycle remove` command](/workers/wrangler/commands/#r2-bucket-lifecycle-remove).

```sh
npx wrangler r2 bucket lifecycle remove <BUCKET_NAME> --id <RULE_ID>
```

### S3 API

```js
import S3 from "aws-sdk/clients/s3.js";

// Configure the S3 client to talk to R2.
const client = new S3({
	endpoint: "https://<account_id>.r2.cloudflarestorage.com",
	credentials: {
		accessKeyId: "<access_key_id>",
		secretAccessKey: "<access_key_secret>",
	},
	region: "auto",
});

// Delete lifecycle configuration for bucket
await client
	.deleteBucketLifecycle({
		Bucket: "bucketName",
	})
	.promise();
```

---

# Public buckets

URL: https://developers.cloudflare.com/r2/buckets/public-buckets/

import { Render } from "~/components";

Public Bucket is a feature that allows users to expose the contents of their R2 buckets directly to the Internet. By default, buckets are never publicly accessible and will always require explicit user permission to enable.

Public buckets can be set up in either one of two ways:

- Expose your bucket as a custom domain under your control.
- Expose your bucket using a Cloudflare-managed `https://r2.dev` subdomain for non-production use cases.

These options can be used independently. Enabling custom domains does not require enabling `r2.dev` access.

To use features like WAF custom rules, caching, access controls, or bot management, you must configure your bucket behind a custom domain. These capabilities are not available when using the `r2.dev` development url.

:::note

Currently, public buckets do not let you list the bucket contents at the root of your (sub) domain.

:::

## Custom domains

### Caching

Domain access through a custom domain allows you to use [Cloudflare Cache](/cache/) to accelerate access to your R2 bucket.

Configure your cache to use [Smart Tiered Cache](/cache/how-to/tiered-cache/#smart-tiered-cache) to have a single upper tier data center next to your R2 bucket.

:::note

By default, only certain file types are cached. To cache all files in your bucket, you must set a Cache Everything page rule.

For more information on default Cache behavior and how to customize it, refer to [Default Cache Behavior](/cache/concepts/default-cache-behavior/#default-cached-file-extensions)

:::

### Access control

To restrict access to your custom domain's bucket, use Cloudflare's existing security products.

- [Cloudflare Zero Trust Access](/cloudflare-one/applications/configure-apps): Protects buckets that should only be accessible by your teammates. Refer to [Protect an R2 Bucket with Cloudflare Access](/r2/tutorials/cloudflare-access/) tutorial for more information.
- [Cloudflare WAF Token Authentication](/waf/custom-rules/use-cases/configure-token-authentication/): Restricts access to documents, files, and media to selected users by providing them with an access token.

:::caution

Disable public access to your [`r2.dev` subdomain](#disable-public-development-url) when using products like WAF or Cloudflare Access. If you do not disable public access, your bucket will remain publicly available through your `r2.dev` subdomain.

:::

### Minimum TLS Version

To specify the minimum TLS version of a custom hostname of an R2 bucket, you can issue an API call to edit [R2 custom domain settings](/api/resources/r2/subresources/buckets/subresources/domains/subresources/custom/methods/update/).

## Add your domain to Cloudflare

The domain being used must have been added as a [zone](/fundamentals/concepts/accounts-and-zones/#zones) in the same account as the R2 bucket.

- If your domain is already managed by Cloudflare, you can proceed to [Connect a bucket to a custom domain](/r2/buckets/public-buckets/#connect-a-bucket-to-a-custom-domain).
- If your domain is not managed by Cloudflare, you need to set it up using a [partial (CNAME) setup](/dns/zone-setups/partial-setup/) to add it to your account.

Once the domain exists in your Cloudflare account (regardless of setup type), you can link it to your bucket.

## Connect a bucket to a custom domain

<Render file="custom-domain-steps" />

To view the added DNS record, select **...** next to the connected domain and select **Manage DNS**.

:::note

If the zone is on an Enterprise plan, make sure that you [release the zone hold](/fundamentals/account/account-security/zone-holds/#release-zone-holds) before adding the custom domain.

A zone hold would prevent the custom subdomain from activating.

:::

## Disable domain access

Disabling a domain will turn off public access to your bucket through that domain. Access through other domains or the managed `r2.dev` subdomain are unaffected.
The specified domain will also remain connected to R2 until you remove it or delete the bucket.

To disable a domain:

1. In **R2**, select the bucket you want to modify.
2. On the bucket page, Select **Settings**, go to **Custom Domains**.
3. Next to the domain you want to disable, select **...** and **Disable domain**.
4. The badge under **Access to Bucket** will update to **Not allowed**.

## Remove domain

Removing a custom domain will disconnect it from your bucket and delete its configuration from the dashboard. Your bucket will remain publicly accessible through any other enabled access method, but the domain will no longer appear in the connected domains list.

To remove a domain:

1. In **R2**, select the bucket you want to modify.
2. On the bucket page, Select **Settings**, go to **Custom Domains**.
3. Next to the domain you want to disable, select **...** and **Remove domain**.
4. Select ‘Remove domain’ in the confirmation window. This step also removes the CNAME record pointing to the domain. You can always add the domain again.

## Public development URL

Expose the contents of this R2 bucket to the internet through a Cloudflare-managed r2.dev subdomain. This endpoint is intended for non-production traffic.

:::note

Public access through `r2.dev` subdomains are rate limited and should only be used for development purposes.

To enable access management, Cache and bot management features, you must set up a custom domain when enabling public access to your bucket.

Avoid creating a CNAME record pointing to the `r2.dev` subdomain. This is an **unsupported access path**, and we cannot guarantee consistent reliability or performance. For production use, [add your domain to Cloudflare](#add-your-domain-to-cloudflare) instead.
:::

### Enable public development url

When you enable public development URL access for your bucket, its contents become available on the internet through a Cloudflare-managed `r2.dev` subdomain.

To enable access through `r2.dev` for your buckets:

1. In **R2**, select the bucket you want to modify.
2. On the bucket page, select **Settings**.
3. Under **Public Development URL**, select **Enable**.
4. In **Allow Public Access?**, confirm your choice by typing ‘allow’ to confirm and select **Allow**.
5. You can now access the bucket and its objects using the Public Bucket URL.

To verify that your bucket is publicly accessible, check that **Public URL Access** shows **Allowed** in you bucket settings.

### Disable public development url

Disabling public development URL access removes your bucket’s exposure through the `r2.dev` subdomain. The bucket and its objects will no longer be accessible via the Public Bucket URL.

If you have connected other domains, the bucket will remain accessible for those domains.

To disable public access for your bucket:

1. In **R2**, select the bucket you want to modify.
2. On the bucket page, select **Settings**.
3. Under **Public Development URL**, select **Disable**.
4. In **Disallow Public Access?**, type ‘disallow’ to confirm and select **Disallow**.

---

# Storage classes

URL: https://developers.cloudflare.com/r2/buckets/storage-classes/

import { Badge, Tabs, TabItem } from "~/components"

Storage classes allow you to trade off between the cost of storage and the cost of accessing data. Every object stored in R2 has an associated storage class.

All storage classes share the following characteristics:

* Compatible with Workers API, S3 API, and public buckets.
* 99.999999999% (eleven 9s) of annual durability.
* No minimum object size.

## Available storage classes

| Storage class                  | Minimum storage duration  | Data retrieval fees (processing) | Egress fees (data transfer to Internet)  |
|--------------------------------|---------------------------|----------------------------------|------------------------------------------|
| Standard                       | None                      | None                             | None                                     |
| Infrequent Access              | 30 days                   | Yes                              | None                                     |

For more information on how storage classes impact pricing, refer to [Pricing](/r2/pricing/).

### Standard storage

Standard storage is designed for data that is accessed frequently. This is the default storage class for new R2 buckets unless otherwise specified.

#### Example use cases

* Website and application data
* Media content (e.g., images, video)
* Storing large datasets for analysis and processing
* AI training data
* Other workloads involving frequently accessed data

### Infrequent Access storage <Badge text="Beta" variant="caution" size="small" />

:::note[Open Beta]


This feature is currently in beta. To report bugs or request features, go to the #r2 channel in the [Cloudflare Developer Discord](https://discord.cloudflare.com) or fill out the [feedback form](https://forms.gle/5FqffSHcsL8ifEG8A).


:::

Infrequent Access storage is ideal for data that is accessed less frequently. This storage class offers lower storage cost compared to Standard storage, but includes [retrieval fees](/r2/pricing/#data-retrieval) and a 30 day [minimum storage duration](/r2/pricing/#minimum-storage-duration) requirement.

:::note


For objects stored in Infrequent Access storage, you will be charged for the object for the minimum storage duration even if the object was deleted, moved, or replaced before the specified duration.


:::

#### Example use cases

* Long-term data archiving (for example, logs and historical records needed for compliance)
* Data backup and disaster recovery
* Long tail user-generated content

## Set default storage class for buckets

By setting the default storage class for a bucket, all objects uploaded into the bucket will automatically be assigned the selected storage class unless otherwise specified. Default storage class can be changed after bucket creation in the Dashboard.

To learn more about creating R2 buckets, refer to [Create new buckets](/r2/buckets/create-buckets/).

## Set storage class for objects

### Specify storage class during object upload

To learn more about how to specify the storage class for new objects, refer to the [Workers API](/r2/api/workers/) and [S3 API](/r2/api/s3/) documentation.

### Use object lifecycle rules to transition objects to Infrequent Access storage

:::note


Once an object is stored in Infrequent Access, it cannot be transitioned to Standard Access using lifecycle policies.


:::

To learn more about how to transition objects from Standard storage to Infrequent Access storage, refer to [Object lifecycles](/r2/buckets/object-lifecycles/).

## Change storage class for objects

You can change the storage class of an object which is already stored in R2 using the [`CopyObject` API](https://docs.aws.amazon.com/AmazonS3/latest/API/API_CopyObject.html).

Use the `x-amz-storage-class` header to change between `STANDARD` and `STANDARD_IA`.

An example of switching an object from `STANDARD` to `STANDARD_IA` using `aws cli` is shown below:

```sh
aws s3api copy-object \
  --endpoint-url https://<ACCONUT_ID>.r2.cloudflarestorage.com \
  --bucket bucket-name \
  --key path/to/object.txt \
  --copy-source /bucket-name/path/to/object.txt \
  --storage-class STANDARD_IA
```

- Refer to [aws CLI](/r2/examples/aws/aws-cli/) for more information on using `aws CLI`.
- Refer to [object-level operations](/r2/api/s3/api/#object-level-operations) for the full list of object-level API operations with R2-compatible S3 API.

---

# Getting started

URL: https://developers.cloudflare.com/r2/data-catalog/get-started/

import {
	Render,
	PackageManagers,
	Steps,
	FileTree,
	Tabs,
	TabItem,
	TypeScriptExample,
	WranglerConfig,
	LinkCard,
} from "~/components";

## Overview

This guide will instruct you through:

- Creating your first [R2 bucket](/r2/buckets/) and enabling its [data catalog](/r2/data-catalog/).
- Creating an [API token](/r2/api/tokens/) needed for query engines to authenticate with your data catalog.
- Using [PyIceberg](https://py.iceberg.apache.org/) to create your first Iceberg table in a [marimo](https://marimo.io/) Python notebook.
- Using [PyIceberg](https://py.iceberg.apache.org/) to load sample data into your table and query it.

## Prerequisites

<Render file="prereqs" product="workers" />

## 1. Create an R2 bucket

<Tabs syncKey='CLIvDash'>
<TabItem label='Wrangler CLI'>

<Steps>
1. If not already logged in, run:

    	```
    	npx wrangler login
    	```

2.  Create an R2 bucket:

        ```
        npx wrangler r2 bucket create r2-data-catalog-tutorial
        ```

</Steps>

</TabItem>
<TabItem label='Dashboard'>

<Steps>
1. From the Cloudflare dashboard, select **R2 Object Storage** from the sidebar.
2. Select **Create bucket**.
3. Enter the bucket name: r2-data-catalog-tutorial
4. Select **Create bucket**.
</Steps>
</TabItem>
</Tabs>

## 2. Enable the data catalog for your bucket

<Tabs syncKey='CLIvDash'>
<TabItem label='Wrangler CLI'>

Then, enable the catalog on your chosen R2 bucket:

        ```
        npx wrangler r2 bucket catalog enable r2-data-catalog-tutorial
        ```

When you run this command, take note of the "Warehouse" and "Catalog URI". You will need these later. 

</TabItem>
<TabItem label='Dashboard'>

<Steps>
1. From the Cloudflare dashboard, select **R2 Object Storage** from the sidebar.
2. Select the bucket: r2-data-catalog-tutorial.
3. Switch to the **Settings** tab, scroll down to **R2 Data Catalog**, and select **Enable**.
4. Once enabled, note the **Catalog URI** and **Warehouse name**.
</Steps>
</TabItem>
</Tabs>

## 3. Create an API token

Iceberg clients (including [PyIceberg](https://py.iceberg.apache.org/)) must authenticate to the catalog with a [Cloudflare API token](/fundamentals/api/get-started/create-token/) that has both R2 and catalog permissions.

<Steps>
1. From the Cloudflare dashboard, select **R2 Object Storage** from the sidebar.

2. Expand the **API** dropdown and select **Manage API tokens**.

3. Select **Create API token**.

4. Select the **R2 Token** text to edit your API token name.

5. Under **Permissions**, choose the **Admin Read & Write** permission.

6. Select **Create API Token**.

7. Note the **Token value**.

</Steps>

## 4. Install uv

You need to install a Python package manager. In this guide, use [uv](https://docs.astral.sh/uv/). If you do not already have uv installed, follow the [installing uv guide](https://docs.astral.sh/uv/getting-started/installation/).

## 5. Install marimo and set up your project with uv

We will use [marimo](https://github.com/marimo-team/marimo) as a Python notebook.

<Steps>
1. Create a directory where our notebook will be stored:

    	```
    	mkdir r2-data-catalog-notebook
    	```

2. Change into our new directory:

      ```
      cd r2-data-catalog-notebook
      ```

3. Initialize a new uv project (this creates a `.venv` and a `pyproject.toml`):

      ```
      uv init
      ```

4. Add marimo and required dependencies:

      ```py
      uv add marimo pyiceberg pyarrow pandas
      ```

</Steps>

## 6. Create a Python notebook to interact with the data warehouse

<Steps>
1. Create a file called `r2-data-catalog-tutorial.py`.

2. Paste the following code snippet into your `r2-data-catalog-tutorial.py` file:

        ```py
        import marimo

        __generated_with = "0.11.31"
        app = marimo.App(width="medium")


        @app.cell
        def _():
        		import marimo as mo
        		return (mo,)


        @app.cell
        def _():
        		import pandas
        		import pyarrow as pa
        		import pyarrow.compute as pc
        		import pyarrow.parquet as pq

        		from pyiceberg.catalog.rest import RestCatalog

        		# Define catalog connection details (replace variables)
        		WAREHOUSE = "<WAREHOUSE>"
        		TOKEN = "<TOKEN>"
        		CATALOG_URI = "<CATALOG_URI>"

        		# Connect to R2 Data Catalog
        		catalog = RestCatalog(
        				name="my_catalog",
        				warehouse=WAREHOUSE,
        				uri=CATALOG_URI,
        				token=TOKEN,
        		)
        		return (
        				CATALOG_URI,
        				RestCatalog,
        				TOKEN,
        				WAREHOUSE,
        				catalog,
        				pa,
        				pandas,
        				pc,
        				pq,
        		)


        @app.cell
        def _(catalog):
        		# Create default namespace if needed
        		catalog.create_namespace_if_not_exists("default")
        		return


        @app.cell
        def _(pa):
        		# Create simple PyArrow table
        		df = pa.table({
        				"id": [1, 2, 3],
        				"name": ["Alice", "Bob", "Charlie"],
        				"score": [80.0, 92.5, 88.0],
        		})
        		return (df,)


        @app.cell
        def _(catalog, df):
        		# Create or load Iceberg table
        		test_table = ("default", "people")
        		if not catalog.table_exists(test_table):
        				print(f"Creating table: {test_table}")
        				table = catalog.create_table(
        						test_table,
        						schema=df.schema,
        				)
        		else:
        				table = catalog.load_table(test_table)
        		return table, test_table


        @app.cell
        def _(df, table):
        		# Append data
        		table.append(df)
        		return


        @app.cell
        def _(table):
        		print("Table contents:")
        		scanned = table.scan().to_arrow()
        		print(scanned.to_pandas())
        		return (scanned,)


        @app.cell
        def _():
        		# Optional cleanup. To run uncomment and run cell
        		# print(f"Deleting table: {test_table}")
        		# catalog.drop_table(test_table)
        		# print("Table dropped.")
        		return


        if __name__ == "__main__":
        		app.run()
        ```

3. Replace the `CATALOG_URI`, `WAREHOUSE`, and `TOKEN` variables with your values from sections **2** and **3** respectively.

4. Launch the notebook editor in your browser:

    	```
    	uv run marimo edit r2-data-catalog-tutorial.py
    	```

			Once your notebook connects to the catalog, you'll see the catalog along with its namespaces and tables appear in marimo's Datasources panel.

</Steps>
In the Python notebook above, you:

1. Connect to your catalog.
2. Create the `default` namespace.
3. Create a simple PyArrow table.
4. Create (or load) the `people` table in the `default` namespace.
5. Append sample data to the table.
6. Print the contents of the table.
7. (Optional) Drop the `people` table we created for this tutorial.

## Learn more

<LinkCard
	title="Managing catalogs"
	href="/r2/data-catalog/manage-catalogs/"
	description="Enable or disable R2 Data Catalog on your bucket, retrieve configuration details, and authenticate your Iceberg engine."
/>

<LinkCard
	title="Connect to Iceberg engines"
	href="/r2/data-catalog/config-examples/"
	description="Find detailed setup instructions for Apache Spark and other common query engines."
/>

---

# R2 Data Catalog

URL: https://developers.cloudflare.com/r2/data-catalog/

import { Render, LinkCard } from "~/components";

:::note
R2 Data Catalog is in **public beta**, and any developer with an [R2 subscription](/r2/pricing/) can start using it. Currently, outside of standard R2 storage and operations, you will not be billed for your use of R2 Data Catalog.
:::

R2 Data Catalog is a managed [Apache Iceberg](https://iceberg.apache.org/) data catalog built directly into your R2 bucket. It exposes a standard Iceberg REST catalog interface, so you can connect the engines you already use, like [Spark](/r2/data-catalog/config-examples/spark-scala/), [Snowflake](/r2/data-catalog/config-examples/snowflake/), and [PyIceberg](/r2/data-catalog/config-examples/pyiceberg/).

R2 Data Catalog makes it easy to turn an R2 bucket into a data warehouse or lakehouse for a variety of analytical workloads including log analytics, business intelligence, and data pipelines. R2's zero-egress fee model means that data users and consumers can access and analyze data from different clouds, data platforms, or regions without incurring transfer costs.

To get started with R2 Data Catalog, refer to the [R2 Data Catalog: Getting started](/r2/data-catalog/get-started/).

## What is Apache Iceberg?

[Apache Iceberg](https://iceberg.apache.org/) is an open table format designed to handle large-scale analytics datasets stored in object storage. Key features include:

- ACID transactions - Ensures reliable, concurrent reads and writes with full data integrity.
- Optimized metadata - Avoids costly full table scans by using indexed metadata for faster queries.
- Full schema evolution - Allows adding, renaming, and deleting columns without rewriting data.

Iceberg is already [widely supported](https://iceberg.apache.org/vendors/) by engines like Apache Spark, Trino, Snowflake, DuckDB, and ClickHouse, with a fast-growing community behind it.

## Why do you need a data catalog?

Although the Iceberg data and metadata files themselves live directly in object storage (like [R2](https://developers.cloudflare.com/r2/)), the list of tables and pointers to the current metadata need to be tracked centrally by a data catalog.

Think of a data catalog as a library's index system. While books (your data) are physically distributed across shelves (object storage), the index provides a single source of truth about what books exist, their locations, and their latest editions. Without this index, readers (query engines) would waste time searching for books, might access outdated versions, or could accidentally shelve new books in ways that make them unfindable.

Similarly, data catalogs ensure consistent, coordinated access, which allows multiple query engines to safely read from and write to the same tables without conflicts or data corruption.

## Learn more

<LinkCard
	title="Get started"
	href="/r2/data-catalog/get-started/"
	description="Learn how to enable the R2 Data Catalog on your bucket, load sample data, and run your first query."
/>

<LinkCard
	title="Managing catalogs"
	href="/r2/data-catalog/manage-catalogs/"
	description="Enable or disable R2 Data Catalog on your bucket, retrieve configuration details, and authenticate your Iceberg engine."
/>

<LinkCard
	title="Connect to Iceberg engines"
	href="/r2/data-catalog/config-examples/"
	description="Find detailed setup instructions for Apache Spark and other common query engines."
/>

---

# Data migration

URL: https://developers.cloudflare.com/r2/data-migration/

Quickly and easily migrate data from other cloud providers to R2. Explore each option further by navigating to their respective documentation page.

<table>
	<tbody>
		<th colspan="5" rowspan="1" style="width:160px">
			Name
		</th>
		<th colspan="5" rowspan="1">
			Description
		</th>
		<th colspan="5" rowspan="1">
			When to use
		</th>
		<tr>
			<td colspan="5" rowspan="1">
				<a href="/r2/data-migration/super-slurper/">Super Slurper</a>
			</td>
			<td colspan="5" rowspan="1">
				Quickly migrate large amounts of data from other cloud providers to R2.
			</td>
			<td colspan="5" rowspan="1">
				<ul>
					<li>For one-time, comprehensive transfers.</li>
				</ul>
			</td>
		</tr>
		<tr>
			<td colspan="5" rowspan="1">
				<a href="/r2/data-migration/sippy/">Sippy</a>
			</td>
			<td colspan="5" rowspan="1">
				Incremental data migration, populating your R2 bucket as objects are
				requested.
			</td>
			<td colspan="5" rowspan="1">
				<ul>
					<li>For gradual migration that avoids upfront egress fees.</li>
					<li>
						To start serving frequently accessed objects from R2 without a full
						migration.
					</li>
				</ul>
			</td>
		</tr>
	</tbody>
</table>

For information on how to leverage these tools effectively, refer to [Migration Strategies](/r2/data-migration/migration-strategies/)

---

# Manage catalogs

URL: https://developers.cloudflare.com/r2/data-catalog/manage-catalogs/

import {
	Render,
	PackageManagers,
	Steps,
	FileTree,
	Tabs,
	TabItem,
	TypeScriptExample,
	WranglerConfig,
	LinkCard,
} from "~/components";

Learn how to:

- Enable and disable [R2 Data Catalog](/r2/data-catalog/) on your buckets.
- Authenticate Iceberg engines using API tokens.

## Enable R2 Data Catalog on a bucket

Enabling the catalog on a bucket turns on the REST catalog interface and provides a **Catalog URI** and **Warehouse name** required by Iceberg clients. Once enabled, you can create and manage Iceberg tables in that bucket.

### Dashboard

<Steps>
1. From the Cloudflare dashboard, select **R2 Object Storage** from the sidebar.
2. Select the bucket you want to enable as a data catalog.
3. Switch to the **Settings** tab, scroll down to **R2 Data Catalog**, and select **Enable**.
4. Once enabled, note the **Catalog URI** and **Warehouse name**.
</Steps>

### Wrangler CLI

To enable the catalog on your bucket, run the [`r2 bucket catalog enable command`](/workers/wrangler/commands/#r2-bucket-catalog-enable):

```bash
npx wrangler r2 bucket catalog enable <BUCKET_NAME>
```

After enabling, Wrangler will return your catalog URI and warehouse name.

## Disable R2 Data Catalog on a bucket

When you disable the catalog on a bucket, it immediately stops serving requests from the catalog interface. Any Iceberg table references stored in that catalog become inaccessible until you re-enable it.

### Dashboard

<Steps>
1. From the Cloudflare dashboard, select **R2 Object Storage** from the sidebar.
2. Select the bucket where you want to disable the data catalog.
3. Switch to the **Settings** tab, scroll down to **R2 Data Catalog**, and select **Disable**.
</Steps>

### Wrangler CLI

To disable the catalog on your bucket, run the [`r2 bucket catalog disable command`](/workers/wrangler/commands/#r2-bucket-catalog-disable):

```bash
npx wrangler r2 bucket catalog disable <BUCKET_NAME>
```

## Authenticate your Iceberg engine

To connect your Iceberg engine to R2 Data Catalog, you must provide a Cloudflare API token with **both** R2 Data Catalog permissions and R2 storage permissions. Iceberg engines interact with R2 Data Catalog to perform table operations. The catalog also provides engines with SigV4 credentials, which are required to access the underlying data files stored in R2.

### Create API token in the dashboard

Create an [R2 API token](/r2/api/tokens/#permissions) with **Admin Read & Write** or **Admin Read only** permissions. These permissions include both:

- Access to R2 Data Catalog (read-only or read/write, depending on chosen permission)
- Access to R2 storage (read-only or read/write, depending on chosen permission)

Providing the resulting token value to your Iceberg engine gives it the ability to manage catalog metadata and handle data operations (reads or writes to R2).

### Create API token via API

To create an API token programmatically for use with R2 Data Catalog, you'll need to specify both R2 Data Catalog and R2 storage permission groups in your [Access Policy](/r2/api/tokens/#access-policy).

#### Example Access Policy

```json
[
	{
		"id": "f267e341f3dd4697bd3b9f71dd96247f",
		"effect": "allow",
		"resources": {
			"com.cloudflare.edge.r2.bucket.4793d734c0b8e484dfc37ec392b5fa8a_default_my-bucket": "*",
			"com.cloudflare.edge.r2.bucket.4793d734c0b8e484dfc37ec392b5fa8a_eu_my-eu-bucket": "*"
		},
		"permission_groups": [
			{
				"id": "d229766a2f7f4d299f20eaa8c9b1fde9",
				"name": "Workers R2 Data Catalog Write"
			},
			{
				"id": "2efd5506f9c8494dacb1fa10a3e7d5b6",
				"name": "Workers R2 Storage Bucket Item Write"
			}
		]
	}
]
```

To learn more about how to create API tokens for R2 Data Catalog using the API, including required permission groups and usage examples, refer to the [Create API tokens via API documentation](/r2/api/tokens/#create-api-tokens-via-api).

## Learn more

<LinkCard
	title="Get started"
	href="/r2/data-catalog/get-started/"
	description="Learn how to enable the R2 Data Catalog on your bucket, load sample data, and run your first query."
/>

<LinkCard
	title="Connect to Iceberg engines"
	href="/r2/data-catalog/config-examples/"
	description="Find detailed setup instructions for Apache Spark and other common query engines."
/>

---

# Migration Strategies

URL: https://developers.cloudflare.com/r2/data-migration/migration-strategies/

import { Render } from "~/components";

You can use a combination of Super Slurper and Sippy to effectively migrate all objects with minimal downtime.

### When the source bucket is actively being read from / written to

1. Enable Sippy and start using the R2 bucket in your application.
   - This copies objects from your previous bucket into the R2 bucket on demand when they are requested by the application.
   - New uploads will go to the R2 bucket.
2. Use Super Slurper to trigger a one-off migration to copy the remaining objects into the R2 bucket.
   - In the **Destination R2 bucket** > **Overwrite files?**, select "Skip existing".

### When the source bucket is not being read often

1. Use Super Slurper to copy all objects to the R2 bucket.
   - Note that Super Slurper may skip some objects if they are uploaded after it lists the objects to be copied.
2. Enable Sippy on your R2 bucket, then start using the R2 bucket in your application.
   - New uploads will go to the R2 bucket.
   - Objects which were uploaded while Super Slurper was copying the objects will be copied on-demand (by Sippy) when they are requested by the application.

---

# Sippy

URL: https://developers.cloudflare.com/r2/data-migration/sippy/

import { Render } from "~/components";

Sippy is a data migration service that allows you to copy data from other cloud providers to R2 as the data is requested, without paying unnecessary cloud egress fees typically associated with moving large amounts of data.

Migration-specific egress fees are reduced by leveraging requests within the flow of your application where you would already be paying egress fees to simultaneously copy objects to R2.

## How it works

When enabled for an R2 bucket, Sippy implements the following migration strategy across [Workers](/r2/api/workers/), [S3 API](/r2/api/s3/), and [public buckets](/r2/buckets/public-buckets/):

- When an object is requested, it is served from your R2 bucket if it is found.
- If the object is not found in R2, the object will simultaneously be returned from your source storage bucket and copied to R2.
- All other operations, including put and delete, continue to work as usual.

## When is Sippy useful?

Using Sippy as part of your migration strategy can be a good choice when:

- You want to start migrating your data, but you want to avoid paying upfront egress fees to facilitate the migration of your data all at once.
- You want to experiment by serving frequently accessed objects from R2 to eliminate egress fees, without investing time in data migration.
- You have frequently changing data and are looking to conduct a migration while avoiding downtime. Sippy can be used to serve requests while [Super Slurper](/r2/data-migration/super-slurper/) can be used to migrate your remaining data.

If you are looking to migrate all of your data from an existing cloud provider to R2 at one time, we recommend using [Super Slurper](/r2/data-migration/super-slurper/).

## Get started with Sippy

Before getting started, you will need:

- An existing R2 bucket. If you don't already have one, refer to [Create buckets](/r2/buckets/create-buckets/).
- [API credentials](/r2/data-migration/sippy/#create-credentials-for-storage-providers) for your source object storage bucket.
- (Wrangler only) Cloudflare R2 Access Key ID and Secret Access Key with read and write permissions. For more information, refer to [Authentication](/r2/api/tokens/).

### Enable Sippy via the Dashboard

1. From the Cloudflare dashboard, select **R2** from the sidebar.
2. Select the bucket you'd like to migrate objects to.
3. Switch to the **Settings** tab, then scroll down to the **On Demand Migration** card.
4. Select **Enable** and enter details for the AWS / GCS bucket you'd like to migrate objects from. The credentials you enter must have permissions to read from this bucket. Cloudflare also recommends scoping your credentials to only allow reads from this bucket.
5. Select **Enable**.

### Enable Sippy via Wrangler

#### Set up Wrangler

To begin, install [`npm`](https://docs.npmjs.com/getting-started). Then [install Wrangler, the Developer Platform CLI](/workers/wrangler/install-and-update/).

#### Enable Sippy on your R2 bucket

Log in to Wrangler with the [`wrangler login` command](/workers/wrangler/commands/#login). Then run the [`r2 bucket sippy enable` command](/workers/wrangler/commands/#r2-bucket-sippy-enable):

```sh
npx wrangler r2 bucket sippy enable <BUCKET_NAME>
```

This will prompt you to select between supported object storage providers and lead you through setup.

### Enable Sippy via API

For information on required parameters and examples of how to enable Sippy, refer to the [API documentation](/api/resources/r2/subresources/buckets/subresources/sippy/methods/update/). For information about getting started with the Cloudflare API, refer to [Make API calls](/fundamentals/api/how-to/make-api-calls/).

:::note

If your bucket is setup with [jurisdictional restrictions](/r2/reference/data-location/#jurisdictional-restrictions), you will need to pass a `cf-r2-jurisdiction` request header with that jurisdiction. For example, `cf-r2-jurisdiction: eu`.

:::

### View migration metrics

When enabled, Sippy exposes metrics that help you understand the progress of your ongoing migrations.

<table>
	<tbody>
		<th colspan="5" rowspan="1" style="width:220px">
			Metric
		</th>
		<th colspan="5" rowspan="1">
			Description
		</th>
		<tr>
			<td colspan="5" rowspan="1">
				Requests served by Sippy
			</td>
			<td colspan="5" rowspan="1">
				The percentage of overall requests served by R2 over a period of time.{" "}
				<br />A higher percentage indicates that fewer requests need to be made
				to the source bucket.
			</td>
		</tr>
		<tr>
			<td colspan="5" rowspan="1">
				Data migrated by Sippy
			</td>
			<td colspan="5" rowspan="1">
				The amount of data that has been copied from the source bucket to R2
				over a period of time. Reported in bytes.
			</td>
		</tr>
	</tbody>
</table>

To view current and historical metrics:

2. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com) and select your account.
3. Go to the [R2 tab](https://dash.cloudflare.com/?to=/:account/r2) and select your bucket.
4. Select the **Metrics** tab.

You can optionally select a time window to query. This defaults to the last 24 hours.

## Disable Sippy on your R2 bucket

### Dashboard

1. From the Cloudflare dashboard, select **R2** from the sidebar.
2. Select the bucket you'd like to disable Sippy for.
3. Switch to the **Settings** tab and scroll down to the **On Demand Migration** card.
4. Press **Disable**.

### Wrangler

To disable Sippy, run the [`r2 bucket sippy disable` command](/workers/wrangler/commands/#r2-bucket-sippy-disable):

```sh
npx wrangler r2 bucket sippy disable <BUCKET_NAME>
```

### API

For more information on required parameters and examples of how to disable Sippy, refer to the [API documentation](/api/resources/r2/subresources/buckets/subresources/sippy/methods/delete/).

## Supported cloud storage providers

Cloudflare currently supports copying data from the following cloud object storage providers to R2:

- Amazon S3
- Google Cloud Storage (GCS)

## R2 API interactions

When Sippy is enabled, it changes the behavior of certain actions on your R2 bucket across [Workers](/r2/api/workers/), [S3 API](/r2/api/s3/), and [public buckets](/r2/buckets/public-buckets/).

<table>
	<tbody>
		<th colspan="5" rowspan="1" style="width:220px">
			Action
		</th>
		<th colspan="5" rowspan="1">
			New behavior
		</th>
		<tr>
			<td colspan="5" rowspan="1">
				GetObject
			</td>
			<td colspan="5" rowspan="1">
				Calls to GetObject will first attempt to retrieve the object from your
				R2 bucket. If the object is not present, the object will be served from
				the source storage bucket and simultaneously uploaded to the requested
				R2 bucket.
				<br />
				<br />
				Additional considerations:
				<ul>
					<li>
						Modifications to objects in the source bucket will not be reflected
						in R2 after the initial copy. Once an object is stored in R2, it
						will not be re-retrieved and updated.
					</li>
					<li>
						Only user-defined metadata that is prefixed by{" "}
						<code>x-amz-meta-</code> in the HTTP response will be migrated.
						Remaining metadata will be omitted.
					</li>
					<li>
						For larger objects (greater than 199 MiB), multiple GET requests may
						be required to fully copy the object to R2.
					</li>
					<li>
						If there are multiple simultaneous GET requests for an object which
						has not yet been fully copied to R2, Sippy may fetch the object from
						the source storage bucket multiple times to serve those requests.
					</li>
				</ul>
			</td>
		</tr>
		<tr>
			<td colspan="5" rowspan="1">
				HeadObject
			</td>
			<td colspan="5" rowspan="1">
				Behaves similarly to GetObject, but only retrieves object metadata. Will
				not copy objects to the requested R2 bucket.
			</td>
		</tr>
		<tr>
			<td colspan="5" rowspan="1">
				PutObject
			</td>
			<td colspan="5" rowspan="1">
				No change to behavior. Calls to PutObject will add objects to the
				requested R2 bucket.
			</td>
		</tr>
		<tr>
			<td colspan="5" rowspan="1">
				DeleteObject
			</td>
			<td colspan="5" rowspan="1">
				No change to behavior. Calls to DeleteObject will delete objects in the
				requested R2 bucket.
				<br />
				<br />
				Additional considerations:
				<ul>
					<li>
						If deletes to objects in R2 are not also made in the source storage
						bucket, subsequent GetObject requests will result in objects being
						retrieved from the source bucket and copied to R2.
					</li>
				</ul>
			</td>
		</tr>
	</tbody>
</table>

Actions not listed above have no change in behavior. For more information, refer to [Workers API reference](/r2/api/workers/workers-api-reference/) or [S3 API compatibility](/r2/api/s3/api/).

## Create credentials for storage providers

### Amazon S3

To copy objects from Amazon S3, Sippy requires access permissions to your bucket. While you can use any AWS Identity and Access Management (IAM) user credentials with the correct permissions, Cloudflare recommends you create a user with a narrow set of permissions.

To create credentials with the correct permissions:

1. Log in to your AWS IAM account.
2. Create a policy with the following format and replace `<BUCKET_NAME>` with the bucket you want to grant access to:

```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Effect": "Allow",
			"Action": ["s3:GetObject"],
			"Resource": ["arn:aws:s3:::<BucketName>/*"]
		}
	]
}
```

3. Create a new user and attach the created policy to that user.

You can now use both the Access Key ID and Secret Access Key when enabling Sippy.

### Google Cloud Storage

To copy objects from Google Cloud Storage (GCS), Sippy requires access permissions to your bucket. Cloudflare recommends using the Google Cloud predefined `Storage Object Viewer` role.

To create credentials with the correct permissions:

1. Log in to your Google Cloud console.
2. Go to **IAM & Admin** > **Service Accounts**.
3. Create a service account with the predefined `Storage Object Viewer` role.
4. Go to the **Keys** tab of the service account you created.
5. Select **Add Key** > **Create a new key** and download the JSON key file.

You can now use this JSON key file when enabling Sippy via Wrangler or API.

## Caveats

### ETags

<Render file="migrator-etag-caveat" params={{ one: "Sippy" }} />

---

# Super Slurper

URL: https://developers.cloudflare.com/r2/data-migration/super-slurper/

import { InlineBadge, Render } from "~/components";

Super Slurper allows you to quickly and easily copy objects from other cloud providers to an R2 bucket of your choice.

Migration jobs:

- Preserve custom object metadata from source bucket by copying them on the migrated objects on R2.
- Do not delete any objects from source bucket.
- Use TLS encryption over HTTPS connections for safe and private object transfers.

## When to use Super Slurper

Using Super Slurper as part of your strategy can be a good choice if the cloud storage bucket you are migrating consists primarily of objects less than 1 TB. Objects greater than 1 TB will be skipped and need to be copied separately.

For migration use cases that do not meet the above criteria, we recommend using tools such as [rclone](/r2/examples/rclone/).

## Use Super Slurper to migrate data to R2

1. From the Cloudflare dashboard, select **R2** > **Data Migration**.
2. Select **Migrate files**.
3. Select the source cloud storage provider that you will be migrating data from.
4. Enter your source bucket name and associated credentials and select **Next**.
5. Enter your R2 bucket name and associated credentials and select **Next**.
6. After you finish reviewing the details of your migration, select **Migrate files**.

You can view the status of your migration job at any time by selecting your migration from **Data Migration** page.

### Source bucket options

#### Bucket sub path (optional)

This setting specifies the prefix within the source bucket where objects will be copied from.

### Destination R2 bucket options

#### Overwrite files?

This setting determines what happens when an object being copied from the source storage bucket matches the path of an existing object in the destination R2 bucket. There are two options:

- Overwrite (default)
- Skip

## Supported cloud storage providers

Cloudflare currently supports copying data from the following cloud object storage providers to R2:

- Amazon S3
- Cloudflare R2
- Google Cloud Storage (GCS)
- All S3-compatible storage providers

### Tested S3-compatible storage providers

The following S3-compatible storage providers have been tested and verified to work with Super Slurper:

- Backblaze B2
- DigitalOcean Spaces
- Scaleway Object Storage
- Wasabi Cloud Object Storage

Super Slurper should support transfers from all S3-compatible storage providers, but the ones listed have been explicitly tested.

:::note

Have you tested and verified another S3-compatible provider? [Open a pull request](https://github.com/cloudflare/cloudflare-docs/edit/production/src/content/docs/r2/data-migration/super-slurper.mdx) or [create a GitHub issue](https://github.com/cloudflare/cloudflare-docs/issues/new).

:::

## Create credentials for storage providers

### Amazon S3

To copy objects from Amazon S3, Super Slurper requires access permissions to your S3 bucket. While you can use any AWS Identity and Access Management (IAM) user credentials with the correct permissions, Cloudflare recommends you create a user with a narrow set of permissions.

To create credentials with the correct permissions:

1. Log in to your AWS IAM account.
2. Create a policy with the following format and replace `<BUCKET_NAME>` with the bucket you want to grant access to:

```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Effect": "Allow",
			"Action": ["s3:Get*", "s3:List*"],
			"Resource": ["arn:aws:s3:::<BUCKET_NAME>", "arn:aws:s3:::<BUCKET_NAME>/*"]
		}
	]
}
```

3. Create a new user and attach the created policy to that user.

You can now use both the Access Key ID and Secret Access Key when defining your source bucket.

### Google Cloud Storage

To copy objects from Google Cloud Storage (GCS), Super Slurper requires access permissions to your GCS bucket. You can use the Google Cloud predefined `Storage Admin` role, but Cloudflare recommends creating a custom role with a narrower set of permissions.

To create a custom role with the necessary permissions:

1. Log in to your Google Cloud console.
2. Go to **IAM & Admin** > **Roles**.
3. Find the `Storage Object Viewer` role and select **Create role from this role**.
4. Give your new role a name.
5. Select **Add permissions** and add the `storage.buckets.get` permission.
6. Select **Create**.

To create credentials with your custom role:

1. Log in to your Google Cloud console.
2. Go to **IAM & Admin** > **Service Accounts**.
3. Create a service account with the your custom role.
4. Go to the **Keys** tab of the service account you created.
5. Select **Add Key** > **Create a new key** and download the JSON key file.

You can now use this JSON key file when enabling Super Slurper.

## Caveats

### ETags

<Render file="migrator-etag-caveat" params={{ one: "Super Slurper" }} />

### Archive storage classes

Objects stored using AWS S3 [archival storage classes](https://aws.amazon.com/s3/storage-classes/#Archive) will be skipped and need to be copied separately. Specifically:

- Files stored using S3 Glacier tiers (not including Glacier Instant Retrieval) will be skipped and logged in the migration log.
- Files stored using S3 Intelligent Tiering and placed in Deep Archive tier will be skipped and logged in the migration log.

---

# Authenticate against R2 API using auth tokens

URL: https://developers.cloudflare.com/r2/examples/authenticate-r2-auth-tokens/

import { Tabs, TabItem } from '~/components';

The following example shows how to authenticate against R2 using the S3 API and an API token. 

:::note
For providing secure access to bucket objects for anonymous users, we recommend using [pre-signed URLs](/r2/api/s3/presigned-urls/) instead.

Pre-signed URLs do not require users to be a member of your organization and enable programmatic application directly.
:::

Ensure you have set the following environmental variables prior to running either example:

```sh
export R2_ACCOUNT_ID=your_account_id
export R2_ACCESS_KEY_ID=your_access_key_id
export R2_SECRET_ACCESS_KEY=your_secret_access_key
export R2_BUCKET_NAME=your_bucket_name
```

<Tabs>
  <TabItem label="JavaScript" icon="seti:javascript">
    Install the `aws-sdk` package for the S3 API:

    ```sh
    npm install aws-sdk
    ```

    ```javascript
    const AWS = require('aws-sdk');
    const crypto = require('crypto');

    const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
    const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
    const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
    const BUCKET_NAME = process.env.R2_BUCKET_NAME;

    // Hash the secret access key
    const hashedSecretKey = crypto.createHash('sha256').update(SECRET_ACCESS_KEY).digest('hex');

    // Configure the S3 client for Cloudflare R2
    const s3Client = new AWS.S3({
        endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
        accessKeyId: ACCESS_KEY_ID,
        secretAccessKey: hashedSecretKey,
        signatureVersion: 'v4',
        region: 'auto' // Cloudflare R2 doesn't use regions, but this is required by the SDK
    });

    // Specify the object key
    const objectKey = '2024/08/02/ingested_0001.parquet';

    // Function to fetch the object
    async function fetchObject() {
        try {
            const params = {
                Bucket: BUCKET_NAME,
                Key: objectKey
            };

            const data = await s3Client.getObject(params).promise();
            console.log('Successfully fetched the object');

            // Process the data as needed
            // For example, to get the content as a Buffer:
            // const content = data.Body;

            // Or to save the file (requires 'fs' module):
            // const fs = require('fs').promises;
            // await fs.writeFile('ingested_0001.parquet', data.Body);

        } catch (error) {
            console.error('Failed to fetch the object:', error);
        }
    }

    fetchObject();
    ```
    </TabItem>
    <TabItem label="Python" icon="seti:python">

    Install the `boto3` S3 API client:

    ```sh
    pip install boto3
    ```

    Run the following Python script with `python3 get_r2_object.py`. Ensure you change `object_key` to point to an existing file in your R2 bucket.

    ```python title="get_r2_object.py"
    import os
    import hashlib
    import boto3
    from botocore.client import Config

    ACCOUNT_ID = os.environ.get('R2_ACCOUNT_ID')
    ACCESS_KEY_ID = os.environ.get('R2_ACCESS_KEY_ID')
    SECRET_ACCESS_KEY = os.environ.get('R2_SECRET_ACCESS_KEY')
    BUCKET_NAME = os.environ.get('R2_BUCKET_NAME')

    # Hash the secret access key using SHA-256
    hashed_secret_key = hashlib.sha256(SECRET_ACCESS_KEY.encode()).hexdigest()

    # Configure the S3 client for Cloudflare R2
    s3_client = boto3.client('s3',
        endpoint_url=f'https://{ACCOUNT_ID}.r2.cloudflarestorage.com',
        aws_access_key_id=ACCESS_KEY_ID,
        aws_secret_access_key=hashed_secret_key,
        config=Config(signature_version='s3v4')
    )

    # Specify the object key
    object_key = '2024/08/02/ingested_0001.parquet'

    try:
        # Fetch the object
        response = s3_client.get_object(Bucket=BUCKET_NAME, Key=object_key)

        print('Successfully fetched the object')

        # Process the response content as needed
        # For example, to read the content:
        # object_content = response['Body'].read()

        # Or to save the file:
        # with open('ingested_0001.parquet', 'wb') as f:
        #     f.write(response['Body'].read())

    except Exception as e:
        print(f'Failed to fetch the object. Error: {str(e)}')
    ```
    </TabItem>
    <TabItem label="Go" icon="seti:go">

    Use `go get` to add the `aws-sdk-go-v2` packages to your Go project:

    ```sh
    go get github.com/aws/aws-sdk-go-v2
    go get github.com/aws/aws-sdk-go-v2/config
    go get github.com/aws/aws-sdk-go-v2/credentials
    go get github.com/aws/aws-sdk-go-v2/service/s3
    ```

    Run the following Go application as a script with `go run main.go`. Ensure you change `objectKey` to point to an existing file in your R2 bucket.

    ```go
    package main

    import (
        "context"
        "crypto/sha256"
        "encoding/hex"
        "fmt"
        "io"
        "log"
        "os"

        "github.com/aws/aws-sdk-go-v2/aws"
        "github.com/aws/aws-sdk-go-v2/config"
        "github.com/aws/aws-sdk-go-v2/credentials"
        "github.com/aws/aws-sdk-go-v2/service/s3"
    )

    func main() {
        // Load environment variables
        accountID := os.Getenv("R2_ACCOUNT_ID")
        accessKeyID := os.Getenv("R2_ACCESS_KEY_ID")
        secretAccessKey := os.Getenv("R2_SECRET_ACCESS_KEY")
        bucketName := os.Getenv("R2_BUCKET_NAME")

        // Hash the secret access key
        hasher := sha256.New()
        hasher.Write([]byte(secretAccessKey))
        hashedSecretKey := hex.EncodeToString(hasher.Sum(nil))

        // Configure the S3 client for Cloudflare R2
        r2Resolver := aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...interface{}) (aws.Endpoint, error) {
            return aws.Endpoint{
                URL: fmt.Sprintf("https://%s.r2.cloudflarestorage.com", accountID),
            }, nil
        })

        cfg, err := config.LoadDefaultConfig(context.TODO(),
            config.WithEndpointResolverWithOptions(r2Resolver),
            config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(accessKeyID, hashedSecretKey, "")),
            config.WithRegion("auto"), // Cloudflare R2 doesn't use regions, but this is required by the SDK
        )
        if err != nil {
            log.Fatalf("Unable to load SDK config, %v", err)
        }

        // Create an S3 client
        client := s3.NewFromConfig(cfg)

        // Specify the object key
        objectKey := "2024/08/02/ingested_0001.parquet"

        // Fetch the object
        output, err := client.GetObject(context.TODO(), &s3.GetObjectInput{
            Bucket: aws.String(bucketName),
            Key:    aws.String(objectKey),
        })
        if err != nil {
            log.Fatalf("Unable to fetch object, %v", err)
        }
        defer output.Body.Close()

        fmt.Println("Successfully fetched the object")

        // Process the object content as needed
        // For example, to save the file:
        // file, err := os.Create("ingested_0001.parquet")
        // if err != nil {
        // 	log.Fatalf("Unable to create file, %v", err)
        // }
        // defer file.Close()
        // _, err = io.Copy(file, output.Body)
        // if err != nil {
        // 	log.Fatalf("Unable to write file, %v", err)
        // }

        // Or to read the content:
        content, err := io.ReadAll(output.Body)
        if err != nil {
            log.Fatalf("Unable to read object content, %v", err)
        }
        fmt.Printf("Object content length: %d bytes\n", len(content))
    }
    ```
    </TabItem>
  </Tabs>

---

# Examples

URL: https://developers.cloudflare.com/r2/examples/

import { DirectoryListing, GlossaryTooltip } from "~/components";

Explore the following <GlossaryTooltip term="code example">examples</GlossaryTooltip> of how to use SDKs and other tools with R2.

<DirectoryListing />

---

# Use the Cache API

URL: https://developers.cloudflare.com/r2/examples/cache-api/

Use the [Cache API](/workers/runtime-apis/cache/) to store R2 objects in Cloudflare's cache.

:::note


You will need to [connect a custom domain](/workers/configuration/routing/custom-domains/) or [route](/workers/configuration/routing/routes/) to your Worker in order to use the Cache API. Cache API operations in the Cloudflare Workers dashboard editor, Playground previews, and any `*.workers.dev` deployments will have no impact.


:::

```js

export default {
  async fetch(request, env, context) {
    try {
      const url = new URL(request.url);

      // Construct the cache key from the cache URL
      const cacheKey = new Request(url.toString(), request);
      const cache = caches.default;

      // Check whether the value is already available in the cache
      // if not, you will need to fetch it from R2, and store it in the cache
      // for future access
      let response = await cache.match(cacheKey);

      if (response) {
        console.log(`Cache hit for: ${request.url}.`);
        return response;
      }

      console.log(
        `Response for request url: ${request.url} not present in cache. Fetching and caching request.`
      );

      // If not in cache, get it from R2
      const objectKey = url.pathname.slice(1);
      const object = await env.MY_BUCKET.get(objectKey);
      if (object === null) {
        return new Response('Object Not Found', { status: 404 });
      }

      // Set the appropriate object headers
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);

      // Cache API respects Cache-Control headers. Setting s-max-age to 10
      // will limit the response to be in cache for 10 seconds max
      // Any changes made to the response here will be reflected in the cached value
      headers.append('Cache-Control', 's-maxage=10');

      response = new Response(object.body, {
        headers,
      });

      // Store the fetched response as cacheKey
      // Use waitUntil so you can return the response without blocking on
      // writing to cache
      context.waitUntil(cache.put(cacheKey, response.clone()));

      return response;
    } catch (e) {
      return new Response('Error thrown ' + e.message);
    }
  },
};
```

---

# Rclone

URL: https://developers.cloudflare.com/r2/examples/rclone/

import { Render, Steps } from "~/components";

<Render file="keys" />
<br />

Rclone is a command-line tool which manages files on cloud storage. You can use rclone to upload objects to R2 concurrently.

## Configure rclone

With [`rclone`](https://rclone.org/install/) installed, you may run [`rclone config`](https://rclone.org/s3/) to configure a new S3 storage provider. You will be prompted with a series of questions for the new provider details.

:::note[Recommendation]
It is recommended that you choose a unique provider name and then rely on all default answers to the prompts.

This will create a `rclone` configuration file, which you can then modify with the preset configuration given below.
:::

<Steps>
1. Create new remote by selecting `n`.
2. Select a name for the new remote. For example, use `r2`.
3. Select the `Amazon S3 Compliant Storage Providers` storage type.
4. Select `Cloudflare R2 storage` for the provider.
5. Select whether you would like to enter AWS credentials manually, or get it from the runtime environment.
6. Enter the AWS Access Key ID.
7. Enter AWS Secret Access Key (password).
8. Select the region to connect to (optional).
9. Select the S3 API endpoint.
</Steps>

:::note
Ensure you are running `rclone` v1.59 or greater ([rclone downloads](https://beta.rclone.org/)). Versions prior to v1.59 may return `HTTP 401: Unauthorized` errors, as earlier versions of `rclone` do not strictly align to the S3 specification in all cases.
:::

### Edit an existing rclone configuration

If you have already configured `rclone` in the past, you may run `rclone config file` to print the location of your `rclone` configuration file:

```sh
rclone config file
# Configuration file is stored at:
# ~/.config/rclone/rclone.conf
```

Then use an editor (`nano` or `vim`, for example) to add or edit the new provider. This example assumes you are adding a new `r2` provider:

```toml
[r2]
type = s3
provider = Cloudflare
access_key_id = abc123
secret_access_key = xyz456
endpoint = https://<accountid>.r2.cloudflarestorage.com
acl = private
```

:::note

If you are using a token with [Object-level permissions](/r2/api/tokens/#permissions), you will need to add `no_check_bucket = true` to the configuration to avoid errors.
:::

You may then use the new `rclone` provider for any of your normal workflows.

## List buckets & objects

The [rclone tree](https://rclone.org/commands/rclone_tree/) command can be used to list the contents of the remote, in this case Cloudflare R2.

```sh
rclone tree r2:
# /
# ├── user-uploads
# │   └── foobar.png
# └── my-bucket-name
#     ├── cat.png
#     └── todos.txt

rclone tree r2:my-bucket-name
# /
# ├── cat.png
# └── todos.txt
```

## Upload and retrieve objects

The [rclone copy](https://rclone.org/commands/rclone_copy/) command can be used to upload objects to an R2 bucket and vice versa - this allows you to upload files up to the 5 TB maximum object size that R2 supports.

```sh
# Upload dog.txt to the user-uploads bucket
rclone copy dog.txt r2:user-uploads/
rclone tree r2:user-uploads
# /
# ├── foobar.png
# └── dog.txt

# Download dog.txt from the user-uploads bucket
rclone copy r2:user-uploads/dog.txt .
```

### A note about multipart upload part sizes

For multipart uploads, part sizes can significantly affect the number of Class A operations that are used, which can alter how much you end up being charged.
Every part upload counts as a separate operation, so larger part sizes will use fewer operations, but might be costly to retry if the upload fails. Also consider that a multipart upload is always going to consume at least 3 times as many operations as a single `PutObject`, because it will include at least one `CreateMultipartUpload`, `UploadPart` & `CompleteMultipartUpload` operations.

Balancing part size depends heavily on your use-case, but these factors can help you minimize your bill, so they are worth thinking about.

You can configure rclone's multipart upload part size using the `--s3-chunk-size` CLI argument. Note that you might also have to adjust the `--s3-upload-cutoff` argument to ensure that rclone is using multipart uploads. Both of these can be set in your configuration file as well. Generally, `--s3-upload-cutoff` will be no less than `--s3-chunk-size`.

```sh
rclone copy long-video.mp4 r2:user-uploads/ --s3-upload-cutoff=100M --s3-chunk-size=100M
```

## Generate presigned URLs

You can also generate presigned links which allow you to share public access to a file temporarily using the [rclone link](https://rclone.org/commands/rclone_link/) command.

```sh
# You can pass the --expire flag to determine how long the presigned link is valid. The --unlink flag isn't supported by R2.
rclone link r2:my-bucket-name/cat.png --expire 3600
# https://<accountid>.r2.cloudflarestorage.com/my-bucket-name/cat.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=<credential>&X-Amz-Date=<timestamp>&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=<signature>
```

---

# Use SSE-C

URL: https://developers.cloudflare.com/r2/examples/ssec/

import { Tabs, TabItem } from "~/components";

The following tutorial shows some snippets for how to use Server-Side Encryption with Customer-Provided Keys (SSE-C) on R2.

## Before you begin

- When using SSE-C, make sure you store your encryption key(s) in a safe place. In the event you misplace them, Cloudflare will be unable to recover the body of any objects encrypted using those keys.
- While SSE-C does provide MD5 hashes, this hash can be used for identification of keys only. The MD5 hash is not used in the encryption process itself.

## Workers

<Tabs>
	<TabItem label="TypeScript" icon="seti:typescript">
		```typescript
		interface Environment {
			R2: R2Bucket
			/**
			 * In this example, your SSE-C is stored as a hexadecimal string (preferably a secret).
			 * The R2 API also supports providing an ArrayBuffer directly, if you want to generate/
			 * store your keys dynamically.
			*/
			SSEC_KEY: string
		}
		export default {
			async fetch(req: Request, env: Env) {
				const { SSEC_KEY, R2 } = env;
				const { pathname: filename } = new URL(req.url);
				switch(req.method) {
					case "GET": {
						const maybeObj = await env.BUCKET.get(filename, {
							onlyIf: req.headers,
							ssecKey: SSEC_KEY,
						});
						if(!maybeObj) {
							return new Response("Not Found", {
								status: 404
							});
						}
						const headers = new Headers();
						maybeObj.writeHttpMetadata(headers);
						return new Response(body, {
							headers
						});
					}
					case 'POST': {
						const multipartUpload = await env.BUCKET.createMultipartUpload(filename, {
							httpMetadata: req.headers,
							ssecKey: SSEC_KEY,
						});
						/**
						 * This example only provides a single-part "multipart" upload.
						 * For multiple parts, the process is the same(the key must be provided)
						 * for every part.
						*/
						const partOne = await multipartUpload.uploadPart(1, req.body, ssecKey);
						const obj = await multipartUpload.complete([partOne]);
						const headers = new Headers();
						obj.writeHttpMetadata(headers);
						return new Response(null, {
							headers,
							status: 201
						});
					}
					case 'PUT': {
						const obj = await env.BUCKET.put(filename, req.body, {
							httpMetadata: req.headers,
							ssecKey: SSEC_KEY,
						});
						const headers = new Headers();
						maybeObj.writeHttpMetadata(headers);
						return new Response(null, {
							headers,
							status: 201
						});
					}
					default: {
						return new Response("Method not allowed", {
							status: 405
						});
					}
				}
			}
		}
		```
	</TabItem>
	<TabItem label="JavaScript" icon="seti:javascript">
		```javascript
		/**
			 * In this example, your SSE-C is stored as a hexadecimal string(preferably a secret).
			 * The R2 API also supports providing an ArrayBuffer directly, if you want to generate/
			 * store your keys dynamically.
		*/
		export default {
			async fetch(req, env) {
				const { SSEC_KEY, R2 } = env;
				const { pathname: filename } = new URL(req.url);
				switch(req.method) {
					case "GET": {
						const maybeObj = await env.BUCKET.get(filename, {
							onlyIf: req.headers,
							ssecKey: SSEC_KEY,
						});
						if(!maybeObj) {
							return new Response("Not Found", {
								status: 404
							});
						}
						const headers = new Headers();
						maybeObj.writeHttpMetadata(headers);
						return new Response(body, {
							headers
						});
					}
					case 'POST': {
						const multipartUpload = await env.BUCKET.createMultipartUpload(filename, {
							httpMetadata: req.headers,
							ssecKey: SSEC_KEY,
						});
						/**
						 * This example only provides a single-part "multipart" upload.
						 * For multiple parts, the process is the same(the key must be provided)
						 * for every part.
						*/
						const partOne = await multipartUpload.uploadPart(1, req.body, ssecKey);
						const obj = await multipartUpload.complete([partOne]);
						const headers = new Headers();
						obj.writeHttpMetadata(headers);
						return new Response(null, {
							headers,
							status: 201
						});
					}
					case 'PUT': {
						const obj = await env.BUCKET.put(filename, req.body, {
							httpMetadata: req.headers,
							ssecKey: SSEC_KEY,
						});
						const headers = new Headers();
						maybeObj.writeHttpMetadata(headers);
						return new Response(null, {
							headers,
							status: 201
						});
					}
					default: {
						return new Response("Method not allowed", {
							status: 405
						});
					}
				}
			}
		}
		```
	</TabItem>
</Tabs>

## S3-API

<Tabs>
	<TabItem label="@aws-sdk/client-s3" icon="seti:typescript">
		```typescript
		import {
			UploadPartCommand,
			PutObjectCommand, S3Client,
			CompleteMultipartUploadCommand,
			CreateMultipartUploadCommand,
			type UploadPartCommandOutput
		} from "@aws-sdk/client-s3";

    	const s3 = new S3Client({
    		endpoint: process.env.R2_ENDPOINT,
    		credentials: {
    			accessKeyId: process.env.R2_ACCESS_KEY_ID,
    			secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    		},
    	});

    	const SSECustomerAlgorithm = "AES256";
    	const SSECustomerKey = process.env.R2_SSEC_KEY;
    	const SSECustomerKeyMD5 = process.env.R2_SSEC_KEY_MD5;

    	await s3.send(
    		new PutObjectCommand({
    			Bucket: "your-bucket",
    			Key: "single-part",
    			Body: "BeepBoop",
    			SSECustomerAlgorithm,
    			SSECustomerKey,
    			SSECustomerKeyMD5,
    		}),
    	);

    	const multi = await s3.send(
    		new CreateMultipartUploadCommand({
    			Bucket: "your-bucket",
    			Key: "multi-part",
    			SSECustomerAlgorithm,
    			SSECustomerKey,
    			SSECustomerKeyMD5,
    		}),
    	);
    	const UploadId = multi.UploadId;

    	const parts: UploadPartCommandOutput[] = [];

    	parts.push(
    		await s3.send(
    			new UploadPartCommand({
    				Bucket: "your-bucket",
    				Key: "multi-part",
    				UploadId,
    				// 	filledBuf()` generates some random data.
    				// Replace with a function/body of your choice.
    				Body: filledBuf(),
    				PartNumber: 1,
    				SSECustomerAlgorithm,
    				SSECustomerKey,
    				SSECustomerKeyMD5,
    			}),
    		),
    	);
    	parts.push(
    		await s3.send(
    			new UploadPartCommand({
    				Bucket: "your-bucket",
    				Key: "multi-part",
    				UploadId,
    				// 	filledBuf()` generates some random data.
    				// Replace with a function/body of your choice.
    				Body: filledBuf(),
    				PartNumber: 2,
    				SSECustomerAlgorithm,
    				SSECustomerKey,
    				SSECustomerKeyMD5,
    			}),
    		),
    	);
    	await s3.send(
    		new CompleteMultipartUploadCommand({
    			Bucket: "your-bucket",
    			Key: "multi-part",
    			UploadId,
    			MultipartUpload: {
    				Parts: parts.map(({ ETag }, PartNumber) => ({
    					ETag,
    					PartNumber: PartNumber + 1,
    				})),
    			},
    			SSECustomerAlgorithm,
    			SSECustomerKey,
    			SSECustomerKeyMD5,
    		}),
    	);

    	const HeadObjectOutput = await s3.send(
    		new HeadObjectCommand({
    			Bucket: "your-bucket",
    			Key: "multi-part",
    			SSECustomerAlgorithm,
    			SSECustomerKey,
    			SSECustomerKeyMD5,
    		}),
    	);

    	const GetObjectOutput = await s3.send(
    		new GetObjectCommand({
    			Bucket: "your-bucket",
    			Key: "single-part",
    			SSECustomerAlgorithm,
    			SSECustomerKey,
    			SSECustomerKeyMD5,
    		}),
    	);
    ```

  </TabItem>

</Tabs>

---

# Terraform (AWS)

URL: https://developers.cloudflare.com/r2/examples/terraform-aws/

import { Render } from "~/components";

<Render file="keys" />
<br />

This example shows how to configure R2 with Terraform using the [AWS provider](https://github.com/hashicorp/terraform-provider-aws).

:::note[Note for using AWS provider]

For using only the Cloudflare provider, see [Terraform](/r2/examples/terraform/).

:::

With [`terraform`](https://developer.hashicorp.com/terraform/downloads) installed:

1. Create `main.tf` file, or edit your existing Terraform configuration
2. Populate the endpoint URL at `endpoints.s3` with your [Cloudflare account ID](/fundamentals/account/find-account-and-zone-ids/)
3. Populate `access_key` and `secret_key` with the corresponding [R2 API credentials](/r2/api/tokens/).
4. Ensure that `skip_region_validation = true`, `skip_requesting_account_id = true`, and `skip_credentials_validation = true` are set in the provider configuration.

```hcl
terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
      version = "~> 5"
    }
  }
}

provider "aws" {
  region = "us-east-1"

  access_key = <R2 Access Key>
  secret_key = <R2 Secret Key>

	# Required for R2.
	# These options disable S3-specific validation on the client (Terraform) side.
  skip_credentials_validation = true
  skip_region_validation      = true
  skip_requesting_account_id  = true

  endpoints {
    s3 = "https://<account id>.r2.cloudflarestorage.com"
  }
}

resource "aws_s3_bucket" "default" {
  bucket = "<org>-test"
}

resource "aws_s3_bucket_cors_configuration" "default" {
  bucket   = aws_s3_bucket.default.id

  cors_rule {
    allowed_methods = ["GET"]
    allowed_origins = ["*"]
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "default" {
  bucket = aws_s3_bucket.default.id

  rule {
    id     = "expire-bucket"
    status = "Enabled"
    expiration {
      days = 1
    }
  }

  rule {
    id     = "abort-multipart-upload"
    status = "Enabled"
    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}
```

You can then use `terraform plan` to view the changes and `terraform apply` to apply changes.

---

# Terraform

URL: https://developers.cloudflare.com/r2/examples/terraform/

import { Render } from "~/components"

<Render file="keys" /><br/>

This example shows how to configure R2 with Terraform using the [Cloudflare provider](https://github.com/cloudflare/terraform-provider-cloudflare).

:::note[Note for using AWS provider]


When using the Cloudflare Terraform provider, you can only manage buckets. To configure items such as CORS and object lifecycles, you will need to use the [AWS Provider](/r2/examples/terraform-aws/).


:::

With [`terraform`](https://developer.hashicorp.com/terraform/downloads) installed, create `main.tf` and copy the content below replacing with your API Token.

```hcl
terraform {
  required_providers {
    cloudflare = {
      source = "cloudflare/cloudflare"
      version = "~> 4"
    }
  }
}

provider "cloudflare" {
  api_token = "<YOUR_API_TOKEN>"
}

resource "cloudflare_r2_bucket" "cloudflare-bucket" {
  account_id = "<YOUR_ACCOUNT_ID>"
  name       = "my-tf-test-bucket"
  location   = "WEUR"
}
```

You can then use `terraform plan` to view the changes and `terraform apply` to apply changes.

---

# Delete objects

URL: https://developers.cloudflare.com/r2/objects/delete-objects/

import { Render } from "~/components";

You can delete objects from your bucket from the Cloudflare dashboard or using the Wrangler.

## Delete objects via the Cloudflare dashboard

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com) and select **R2**.
2. From the **R2** page in the dashboard, locate and select your bucket.
3. From your bucket's page, locate the object you want to delete. You can select multiple objects to delete at one time.
4. Select your objects and select **Delete**.
5. Confirm your choice by selecting **Delete**.

## Delete objects via Wrangler

:::caution

Deleting objects from a bucket is irreversible.

:::

You can delete an object directly by calling `delete` against a `{bucket}/{path/to/object}`.

For example, to delete the object `foo.png` from bucket `test-bucket`:

```sh
wrangler r2 object delete test-bucket/foo.png
```

```sh output

Deleting object "foo.png" from bucket "test-bucket".
Delete complete.
```

<Render file="link-to-workers-r2-api" product="r2"/>

---

# Objects

URL: https://developers.cloudflare.com/r2/objects/

import { DirectoryListing, Render } from "~/components"

Objects are individual files or data that you store in an R2 bucket.

<DirectoryListing />

<Render file="link-to-workers-r2-api" product="r2"/>

---

# Download objects

URL: https://developers.cloudflare.com/r2/objects/download-objects/

import { Render } from "~/components";

You can download objects from your bucket from the Cloudflare dashboard or using the Wrangler.

## Download objects via the Cloudflare dashboard

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com) and select **R2**.
2. From the **R2** page in the dashboard, locate and select your bucket.
3. From your bucket's page, locate the object you want to download.
4. At the end of the object's row, select the menu button and click **Download**.

## Download objects via Wrangler

You can download objects from a bucket, including private buckets in your account, directly.

For example, to download `file.bin` from `test-bucket`:

```sh
wrangler r2 object get test-bucket/file.bin
```

```sh output
Downloading "file.bin" from "test-bucket".
Download complete.
```

The file will be downloaded into the current working directory. You can also use the `--file` flag to set a new name for the object as it is downloaded, and the `--pipe` flag to pipe the download to standard output (stdout).

<Render file="link-to-workers-r2-api" product="r2"/>

---

# Upload objects

URL: https://developers.cloudflare.com/r2/objects/upload-objects/

import { Steps, Tabs, TabItem, Render } from "~/components"

You can upload objects to your bucket from using API (both [Workers Binding API](/r2/api/workers/workers-api-reference/) or [compatible S3 API](/r2/api/s3/api/)), rclone, Cloudflare dashboard, or Wrangler.

## Upload objects via Rclone

Rclone is a command-line tool which manages files on cloud storage. You can use rclone to upload objects to R2. Rclone is useful if you wish to upload multiple objects concurrently.

To use rclone, install it onto your machine using their official documentation - [Install rclone](https://rclone.org/install/).

Upload your files to R2 using the `rclone copy` command.

```sh
# Upload a single file
rclone copy /path/to/local/file.txt r2:bucket_name

# Upload everything in a directory
rclone copy /path/to/local/folder r2:bucket_name
```

Verify that your files have been uploaded by listing the objects stored in the destination R2 bucket using `rclone ls` command.

```sh
rclone ls r2:bucket_name
```

For more information, refer to our [rclone example](/r2/examples/rclone/).

## Upload objects via the Cloudflare dashboard

To upload objects to your bucket from the Cloudflare dashboard:

<Steps>
1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com) and select **R2**.
2. From the **R2** page in the dashboard, locate and select your bucket.
3. Select **Upload**.
4. Choose to either drag and drop your file into the upload area or **select from computer**.
</Steps>

You will receive a confirmation message after a successful upload.

## Upload objects via Wrangler

:::note

Wrangler only supports uploading files up to 315MB in size. To upload large files, we recommend [rclone](/r2/examples/rclone/) or an [S3-compatible](/r2/api/s3/) tool of your choice.

:::

To upload a file to R2, call `put` and provide a name (key) for the object, as well as the path to the file via `--file`:

```sh
wrangler r2 object put test-bucket/dataset.csv --file=dataset.csv
```

```sh output
Creating object "dataset.csv" in bucket "test-bucket".
Upload complete.
```

You can set the `Content-Type` (MIME type), `Content-Disposition`, `Cache-Control` and other HTTP header metadata through optional flags.

:::note
Wrangler's `object put` command only allows you to upload one object at a time.

Use rclone if you wish to upload multiple objects to R2.
:::

<Render file="link-to-workers-r2-api" product="r2"/>

---

# Multipart upload

URL: https://developers.cloudflare.com/r2/objects/multipart-objects/

import { Render } from "~/components";

R2 supports [S3 API's Multipart Upload](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html) with some limitations.

## Limitations

Object part sizes must be at least 5MiB but no larger than 5GiB.  All parts except the last one must be the same size.  The last part has no minimum size, but must be the same or smaller than the other parts.

The maximum number of parts is 10,000.

Most S3 clients conform to these expectations.

## Lifecycles

The default object lifecycle policy for multipart uploads is that incompleted uploads will be automatically aborted 7 days.  This can be changed by [configuring a custom lifecycle policy](/r2/buckets/object-lifecycles/).

## ETags

The ETags for objects uploaded via multipart are different than those uploaded with PutObject.

For uploads created after June 21, 2023, R2's multipart ETags now mimic the behavior of S3.  The ETag of each individual part is the MD5 hash of the contents of the part.  The ETag of the completed multipart object is the hash of the MD5 sums of each of the constituent parts concatenated together followed by a hyphen and the number of parts uploaded.

For example, consider a multipart upload with two parts.  If they have the ETags `bce6bf66aeb76c7040fdd5f4eccb78e6` and `8165449fc15bbf43d3b674595cbcc406` respectively, the ETag of the completed multipart upload will be `f77dc0eecdebcd774a2a22cb393ad2ff-2`.

Note that the binary MD5 sums themselves are concatenated and then summed, not the hexadecimal representation. For example, in order to validate the above example on the command line, you would need do the following:

```
echo -n $(echo -n bce6bf66aeb76c7040fdd5f4eccb78e6 | xxd -r -p -)\
$(echo -n 8165449fc15bbf43d3b674595cbcc406 | xxd -r -p -) | md5sum
```

<Render file="link-to-workers-r2-api" product="r2"/>

---

# Audit Logs

URL: https://developers.cloudflare.com/r2/platform/audit-logs/

[Audit logs](/fundamentals/account/account-security/review-audit-logs/) provide a comprehensive summary of changes made within your Cloudflare account, including those made to R2 buckets. This functionality is available on all plan types, free of charge, and is always enabled.

## Viewing audit logs

To view audit logs for your R2 buckets:

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com/?account=audit-log) and select your account.
2. Go to **Manage Account** > **Audit Log**.

For more information on how to access and use audit logs, refer to [Review audit logs](/fundamentals/account/account-security/review-audit-logs/).

## Logged operations

The following configuration actions are logged:

<table>
  <tbody>
    <th colspan="5" rowspan="1" style="width:220px">
      Operation
    </th>
    <th colspan="5" rowspan="1">
      Description
    </th>
    <tr>
      <td colspan="5" rowspan="1">
        CreateBucket
      </td>
      <td colspan="5" rowspan="1">
        Creation of a new bucket.
      </td>
    </tr>
    <tr>
      <td colspan="5" rowspan="1">
        DeleteBucket
      </td>
      <td colspan="5" rowspan="1">
        Deletion of an existing bucket.
      </td>
    </tr>
    <tr>
      <td colspan="5" rowspan="1">
        AddCustomDomain
      </td>
      <td colspan="5" rowspan="1">
        Addition of a custom domain to a bucket.
      </td>
    </tr>
    <tr>
      <td colspan="5" rowspan="1">
        RemoveCustomDomain
      </td>
      <td colspan="5" rowspan="1">
        Removal of a custom domain from a bucket.
      </td>
    </tr>
    <tr>
      <td colspan="5" rowspan="1">
        ChangeBucketVisibility
      </td>
      <td colspan="5" rowspan="1">
        Change to the managed public access (<code>r2.dev</code>) settings of a bucket.
      </td>
    </tr>
    <tr>
      <td colspan="5" rowspan="1">
        PutBucketStorageClass
      </td>
      <td colspan="5" rowspan="1">
        Change to the default storage class of a bucket.
      </td>
    </tr>
    <tr>
      <td colspan="5" rowspan="1">
        PutBucketLifecycleConfiguration
      </td>
      <td colspan="5" rowspan="1">
        Change to the object lifecycle configuration of a bucket.
      </td>
    </tr>
    <tr>
      <td colspan="5" rowspan="1">
        DeleteBucketLifecycleConfiguration
      </td>
      <td colspan="5" rowspan="1">
        Deletion of the object lifecycle configuration for a bucket.
      </td>
    </tr>
    <tr>
      <td colspan="5" rowspan="1">
        PutBucketCors
      </td>
      <td colspan="5" rowspan="1">
        Change to the CORS configuration for a bucket.
      </td>
    </tr>
    <tr>
      <td colspan="5" rowspan="1">
        DeleteBucketCors
      </td>
      <td colspan="5" rowspan="1">
        Deletion of the CORS configuration for a bucket.
      </td>
    </tr>
  </tbody>
</table>

:::note


Logs for data access operations, such as `GetObject` and `PutObject`, are not included in audit logs. To log HTTP requests made to public R2 buckets, use the [HTTP requests](/logs/reference/log-fields/zone/http_requests/) Logpush dataset.


:::

## Example log entry

Below is an example of an audit log entry showing the creation of a new bucket:

```json
{
  "action": { "info": "CreateBucket", "result": true, "type": "create" },
  "actor": {
    "email": "<ACTOR_EMAIL>",
    "id": "3f7b730e625b975bc1231234cfbec091",
    "ip": "fe32:43ed:12b5:526::1d2:13",
    "type": "user"
  },
  "id": "5eaeb6be-1234-406a-87ab-1971adc1234c",
  "interface": "API",
  "metadata": { "zone_name": "r2.cloudflarestorage.com" },
  "newValue": "",
  "newValueJson": {},
  "oldValue": "",
  "oldValueJson": {},
  "owner": { "id": "1234d848c0b9e484dfc37ec392b5fa8a" },
  "resource": { "id": "my-bucket", "type": "r2.bucket" },
  "when": "2024-07-15T16:32:52.412Z"
}

```

---

# Limits

URL: https://developers.cloudflare.com/r2/platform/limits/

import { Render } from "~/components";

| Feature                                                             | Limit                        |
| ------------------------------------------------------------------- | ---------------------------- |
| Data storage per bucket                                             | Unlimited                    |
| Maximum number of buckets per account                               | 1,000,000                    |
| Maximum rate of bucket management operations per bucket<sup>1</sup> | 50 per second                |
| Number of custom domains per bucket                                 | 50                           |
| Object key length                                                   | 1,024 bytes                  |
| Object metadata size                                                | 8,192 bytes                  |
| Object size                                                         | 5 TiB per object<sup>2</sup> |
| Maximum upload size<sup>4</sup>                                     | 5 GiB<sup>3</sup>            |
| Maximum upload parts                                                | 10,000                       |
| Maximum concurrent writes to the same object name (key) | 1 per second <sup>5</sup> | 

<sup>1</sup> Bucket management operations include creating, deleting, listing,
and configuring buckets. This limit does _not_ apply to reading or writing objects to a bucket.
<br /> <sup>2</sup> The object size limit is 5 GiB less than 5 TiB, so 4.995
TiB.
<br /> <sup>3</sup> The max upload size is 5 MiB less than 5 GiB, so 4.995 GiB.
<br /> <sup>4</sup> Max upload size applies to uploading a file via one request,
uploading a part of a multipart upload, or copying into a part of a multipart
upload. If you have a Worker, its inbound request size is constrained by
[Workers request limits](/workers/platform/limits#request-limits). The max
upload size limit does not apply to subrequests.
<br /> <sup>5</sup> Concurrent writes  to the same object name (key) at a higher rate will cause you to see HTTP 429 (rate limited) responses, as you would with other object storage systems.
<br />

Limits specified in MiB (mebibyte), GiB (gibibyte), or TiB (tebibyte) are storage units of measurement based on base-2. 1 GiB (gibibyte) is equivalent to 2<sup>30</sup> bytes (or 1024<sup>3</sup> bytes). This is distinct from 1 GB (gigabyte), which is 10<sup>9</sup> bytes (or 1000<sup>3</sup> bytes).

<Render file="limits_increase" product="workers" />

## Rate limiting on managed public buckets through `r2.dev`

Managed public bucket access through an `r2.dev` subdomain is not intended for production usage and has a variable rate limit applied to it. The `r2.dev` endpoint for your bucket is designed to enable testing.

* If you exceed the rate limit (hundreds of requests/second), requests to your `r2.dev` endpoint will be temporarily throttled and you will receive a `429 Too Many Requests` response.
* Bandwidth (throughput) may also be throttled when using the `r2.dev` endpoint.

For production use cases, connect a [custom domain](/r2/buckets/public-buckets/#custom-domains) to your bucket. Custom domains allow you to serve content from a domain you control (for example, `assets.example.com`), configure fine-grained caching, set up redirect and rewrite rules, mutate content via [Cloudflare Workers](/workers/), and get detailed URL-level analytics for content served from your R2 bucket.

---

# Release-notes

URL: https://developers.cloudflare.com/r2/platform/release-notes/

import { ProductReleaseNotes } from "~/components";

{/* <!-- Actual content lives in /src/content/release-notes/r2.yaml. Update the file there for new entries to appear here. For more details, refer to https://developers.cloudflare.com/style-guide/documentation-content-strategy/content-types/changelog/#yaml-file --> */}

<ProductReleaseNotes />

---

# Metrics and analytics

URL: https://developers.cloudflare.com/r2/platform/metrics-analytics/

R2 exposes analytics that allow you to inspect the requests and storage of the buckets in your account.

The metrics displayed for a bucket in the [Cloudflare dashboard](https://dash.cloudflare.com/) are queried from Cloudflare’s [GraphQL Analytics API](/analytics/graphql-api/). You can access the metrics [programmatically](#query-via-the-graphql-api) via GraphQL or HTTP client.

## Metrics

R2 currently has two datasets:

| <div style="width:100px">Dataset </div> | <div style="width:235px">GraphQL Dataset Name </div> | Description                                                          |
| --------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------- |
| Operations                              | `r2OperationsAdaptiveGroups`                         | This dataset consists of the operations taken buckets of an account. |
| Storage                                 | `r2StorageAdaptiveGroups`                            | This dataset consists of the storage of buckets an account.          |

### Operations Dataset

| <div style="width:175px"> Field </div> | Description                                                                                                                                                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| actionType                             | The name of the operation performed.                                                                                                                                                                                      |
| actionStatus                           | The status of the operation. Can be `success`, `userError`, or `internalError`.                                                                                                                                           |
| bucketName                             | The bucket this operation was performed on if applicable. For buckets with a jurisdiction specified, you must include the jurisdiction followed by an underscore before the bucket name. For example: eu_your-bucket-name |
| objectName                             | The object this operation was performed on if applicable.                                                                                                                                                                 |
| responseStatusCode                     | The http status code returned by this operation.                                                                                                                                                                          |
| datetime                               | The time of the request.                                                                                                                                                                                                  |

### Storage Dataset

| <div style="width:175px"> Field </div> | Description                                                                                                                                                                                                                                                                                          |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| bucketName                             | The bucket this storage value is for. For buckets with a jurisdiction specified, you must include the [jurisdiction](https://developers.cloudflare.com/r2/reference/data-location/#jurisdictional-restrictions) followed by an underscore before the bucket name. For example: `eu_your-bucket-name` |
| payloadSize                            | The size of the objects in the bucket.                                                                                                                                                                                                                                                               |
| metadataSize                           | The size of the metadata of the objects in the bucket.                                                                                                                                                                                                                                               |
| objectCount                            | The number of objects in the bucket.                                                                                                                                                                                                                                                                 |
| uploadCount                            | The number of pending multipart uploads in the bucket.                                                                                                                                                                                                                                               |
| datetime                               | The time that this storage value represents.                                                                                                                                                                                                                                                         |

Metrics can be queried (and are retained) for the past 31 days. These datasets require an `accountTag` filter with your Cloudflare account ID.

## View via the dashboard

Per-bucket analytics for R2 are available in the Cloudflare dashboard. To view current and historical metrics for a bucket:

2. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com) and select your account.
3. Go to the [R2 tab](https://dash.cloudflare.com/?to=/:account/r2) and select your bucket.
4. Select the **Metrics** tab.

You can optionally select a time window to query. This defaults to the last 24 hours.

## Query via the GraphQL API

You can programmatically query analytics for your R2 buckets via the [GraphQL Analytics API](/analytics/graphql-api/). This API queries the same dataset as the Cloudflare dashboard, and supports GraphQL [introspection](/analytics/graphql-api/features/discovery/introspection/).

## Examples

### Operations

To query the volume of each operation type on a bucket for a given time period you can run a query as such

```graphql graphql-api-explorer
query R2VolumeExample(
	$accountTag: string!
	$startDate: Time
	$endDate: Time
	$bucketName: string
) {
	viewer {
		accounts(filter: { accountTag: $accountTag }) {
			r2OperationsAdaptiveGroups(
				limit: 10000
				filter: {
					datetime_geq: $startDate
					datetime_leq: $endDate
					bucketName: $bucketName
				}
			) {
				sum {
					requests
				}
				dimensions {
					actionType
				}
			}
		}
	}
}
```

The `bucketName` field can be removed to get an account level overview of operations. The volume of operations can be broken down even further by adding more dimensions to the query.

### Storage

To query the storage of a bucket over a given time period you can run a query as such.

```graphql graphql-api-explorer
query R2StorageExample(
	$accountTag: string!
	$startDate: Time
	$endDate: Time
	$bucketName: string
) {
	viewer {
		accounts(filter: { accountTag: $accountTag }) {
			r2StorageAdaptiveGroups(
				limit: 10000
				filter: {
					datetime_geq: $startDate
					datetime_leq: $endDate
					bucketName: $bucketName
				}
				orderBy: [datetime_DESC]
			) {
				max {
					objectCount
					uploadCount
					payloadSize
					metadataSize
				}
				dimensions {
					datetime
				}
			}
		}
	}
}
```

---

# Troubleshooting

URL: https://developers.cloudflare.com/r2/platform/troubleshooting/

import { FileTree } from "~/components";

## Troubleshooting 403 / CORS issues with R2

If you are encountering a CORS error despite setting up everything correctly, you may follow this troubleshooting guide to help you.

If you see a 401/403 error above the CORS error in your browser console, you are dealing with a different issue (not CORS related).

If you do have a CORS issue, refer to [Resolving CORS issues](#if-it-is-actually-cors).

### If you are using a custom domain

1. Open developer tools on your browser.
2. Go to the **Network** tab and find the failing request. You may need to reload the page, as requests are only logged after developer tools have been opened.
3. Check the response headers for the following two headers:
- `cf-cache-status`
- `cf-mitigated`

#### If you have a `cf-mitigated` header

Your request was blocked by one of your WAF rules. Inspect your [Security Events](/waf/analytics/security-events/) to identify the cause of the block.

#### If you do not have a `cf-cache-status` header

Your request was blocked by [Hotlink Protection](/waf/tools/scrape-shield/hotlink-protection/).

Edit your Hotlink Protection settings using a [Configuration Rule](/rules/configuration-rules/), or disable it completely.

### If you are using the S3 API

Your request may be incorrectly signed. You may obtain a better error message by trying the request over curl.

Refer to the working S3 signing examples on the [Examples](/r2/examples/aws/) page.

### If it is actually CORS

Here are some common issues with CORS configurations:

- `ExposeHeaders` is missing headers like `ETag`
- `AllowedHeaders` is missing headers like `Authorization` or `Content-Type`
- `AllowedMethods` is missing methods like `POST`/`PUT`

## HTTP 5XX Errors and capacity limitations of Cloudflare R2

When you encounter an HTTP 5XX error, it is usually a sign that your Cloudflare R2 bucket has been overwhelmed by too many concurrent requests. These errors can trigger bucket-wide read and write locks, affecting the performance of all ongoing operations.

To avoid these disruptions, it is important to implement strategies for managing request volume.

Here are some mitigations you can employ:

### Monitor concurrent requests

Track the number of concurrent requests to your bucket. If a client encounters a 5XX error, ensure that it retries the operation and communicates with other clients. By coordinating, clients can collectively slow down, reducing the request rate and maintaining a more stable flow of successful operations.

If your users are directly uploading to the bucket (for example, using the S3 or Workers API), you may not be able to monitor or enforce a concurrency limit. In that case, we recommend bucket sharding.

### Bucket sharding

For higher capacity at the cost of added complexity, consider bucket sharding. This approach distributes reads and writes across multiple buckets, reducing the load on any single bucket.  While sharding cannot prevent a single hot object from exhausting capacity, it can mitigate the overall impact and improve system resilience.

## Objects named `This object is unnamed`

In the Cloudflare dashboard, you can choose to view objects with `/` in the name as folders by selecting **View prefixes as directories**.

For example, an object named `example/object` will be displayed as below.

<FileTree>
- example
  - object
</FileTree>

Object names which end with `/` will cause the Cloudflare dashboard to render the object as a folder with an unnamed object inside.

For example, uploading an object named `example/` into an R2 bucket will be displayed as below.

<FileTree>
- example
  - `This object is unnamed`
</FileTree>

---

# Consistency model

URL: https://developers.cloudflare.com/r2/reference/consistency/

This page details R2's consistency model, including where R2 is strongly, globally consistent and which operations this applies to.

R2 can be described as "strongly consistent", especially in comparison to other distributed object storage systems. This strong consistency ensures that operations against R2 see the latest (accurate) state: clients should be able to observe the effects of any write, update and/or delete operation immediately, globally.

## Terminology

In the context of R2, *strong* consistency and *eventual* consistency have the following meanings:

* **Strongly consistent** - The effect of an operation will be observed globally, immediately, by all clients. Clients will not observe 'stale' (inconsistent) state.
* **Eventually consistent** - Clients may not see the effect of an operation immediately. The state may take a some time (typically seconds to a minute) to propagate globally.

## Operations and Consistency

Operations against R2 buckets and objects adhere to the following consistency guarantees:

<table-wrap>

| Action                                                   | Consistency                                                                                                                                                   |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read-after-write: Write (upload) an object, then read it | Strongly consistent: readers will immediately see the latest object globally                                                                                  |
| Metadata: Update an object's metadata                    | Strongly consistent: readers will immediately see the updated metadata globally                                                                               |
| Deletion: Delete an object                               | Strongly consistent: reads to that object will immediately return a "does not exist" error                                                                    |
| Object listing: List the objects in a bucket             | Strongly consistent: the list operation will list all objects at that point in time                                                                           |
| IAM: Adding/removing R2 Storage permissions              | Eventually consistent: A [new or updated API key](/fundamentals/api/get-started/create-token/) may take up to a minute to have permissions reflected globally |

</table-wrap>

Additional notes:

* In the event two clients are writing (`PUT` or `DELETE`) to the same key, the last writer to complete "wins".
* When performing a multipart upload, read-after-write consistency continues to apply once all parts have been successfully uploaded. In the case the same part is uploaded (in error) from multiple writers, the last write will win.
* Copying an object within the same bucket also follows the same read-after-write consistency that writing a new object would. The "copied" object is immediately readable by all clients once the copy operation completes.

## Caching

:::note


By default, Cloudflare's cache will cache common, cacheable status codes automatically [per our cache documentation](/cache/how-to/configure-cache-status-code/#edge-ttl).


:::

When connecting a [custom domain](/r2/buckets/public-buckets/#custom-domains) to an R2 bucket and enabling caching for objects served from that bucket, the consistency model is necessarily relaxed when accessing content via a domain with caching enabled.

Specifically, you should expect:

* An object you delete from R2, but that is still cached, will still be available. You should [purge the cache](/cache/how-to/purge-cache/) after deleting objects if you need that delete to be reflected.
* By default, Cloudflare’s cache will [cache HTTP 404 (Not Found) responses](/cache/how-to/configure-cache-status-code/#edge-ttl) automatically. If you upload an object to that same path, the cache may continue to return HTTP 404s until the cache TTL (Time to Live) expires and the new object is fetched from R2 or the [cache is purged](/cache/how-to/purge-cache/).
* An object for a given key is overwritten with a new object: the old (previous) object will continue to be served to clients until the cache TTL expires (or the object is evicted) or the cache is purged.

The cache does not affect access via [Worker API bindings](/r2/api/workers/) or the [S3 API](/r2/api/s3/), as these operations are made directly against the bucket and do not transit through the cache.

---

# Data location

URL: https://developers.cloudflare.com/r2/reference/data-location/

import { WranglerConfig } from "~/components";

Learn how the location of data stored in R2 is determined and about the different available inputs that control the physical location where objects in your buckets are stored.

## Automatic (recommended)

When you create a new bucket, the data location is set to Automatic by default. Currently, this option chooses a bucket location in the closest available region to the create bucket request based on the location of the caller.

## Location Hints

Location Hints are optional parameters you can provide during bucket creation to indicate the primary geographical location you expect data will be accessed from.

Using Location Hints can be a good choice when you expect the majority of access to data in a bucket to come from a different location than where the create bucket request originates. Keep in mind Location Hints are a best effort and not a guarantee, and they should only be used as a way to optimize performance by placing regularly updated content closer to users.

### Set hints via the Cloudflare dashboard

You can choose to automatically create your bucket in the closest available region based on your location or choose a specific location from the list.

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com) and select **R2**.
2. Select **Create bucket**.
3. Enter a name for the bucket.
4. Under **Location**, leave _None_ selected for automatic selection or choose a region from the list.
5. Select **Create bucket** to complete the bucket creation process.

### Set hints via the S3 API

You can set the Location Hint via the `LocationConstraint` parameter using the S3 API:

```js
await S3.send(
	new CreateBucketCommand({
		Bucket: "YOUR_BUCKET_NAME",
		CreateBucketConfiguration: {
			LocationConstraint: "WNAM",
		},
	}),
);
```

Refer to [Examples](/r2/examples/) for additional examples from other S3 SDKs.

### Available hints

The following hint locations are supported:

| Hint | Hint description      |
| ---- | --------------------- |
| wnam | Western North America |
| enam | Eastern North America |
| weur | Western Europe        |
| eeur | Eastern Europe        |
| apac | Asia-Pacific          |
| oc   | Oceania               |

### Additional considerations

Location Hints are only honored the first time a bucket with a given name is created. If you delete and recreate a bucket with the same name, the original bucket’s location will be used.

## Jurisdictional Restrictions

Jurisdictional Restrictions guarantee objects in a bucket are stored within a specific jurisdiction.

Use Jurisdictional Restrictions when you need to ensure data is stored and processed within a jurisdiction to meet data residency requirements, including local regulations such as the [GDPR](https://gdpr-info.eu/) or [FedRAMP](https://blog.cloudflare.com/cloudflare-achieves-fedramp-authorization/).

### Set jurisdiction via the Cloudflare dashboard

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com/) and select R2.
2. Select **Create bucket**.
3. Enter a name for the bucket.
4. Under **Location**, select **Specify jurisdiction** and choose a jurisdiction from the list.
5. Select **Create bucket** to complete the bucket creation process.

### Using jurisdictions from Workers

To access R2 buckets that belong to a jurisdiction from [Workers](/workers/), you will need to specify the jurisdiction as well as the bucket name as part of your [bindings](/r2/api/workers/workers-api-usage/#3-bind-your-bucket-to-a-worker) in your [Wrangler configuration file](/workers/wrangler/configuration/):

<WranglerConfig>

```toml
[[r2_buckets]]
bindings = [
  { binding = "MY_BUCKET", bucket_name = "<YOUR_BUCKET_NAME>", jurisdiction = "<JURISDICTION>" }
]
```

</WranglerConfig>

For more information on getting started, refer to [Use R2 from Workers](/r2/api/workers/workers-api-usage/).

### Using jurisdictions with the S3 API

When interacting with R2 resources that belong to a defined jurisdiction with the S3 API or existing S3-compatible SDKs, you must specify the [jurisdiction](#available-jurisdictions) in your S3 endpoint:

`https://<ACCOUNT_ID>.<JURISDICTION>.r2.cloudflarestorage.com`

You can use your jurisdiction-specific endpoint for any [supported S3 API operations](/r2/api/s3/api/). When using a jurisdiction endpoint, you will not be able to access R2 resources outside of that jurisdiction.

The example below shows how to create an R2 bucket in the `eu` jurisdiction using the [`@aws-sdk/client-s3`](https://www.npmjs.com/package/@aws-sdk/client-s3) package for JavaScript.

```js
import { S3Client, CreateBucketCommand } from "@aws-sdk/client-s3";
const S3 = new S3Client({
	endpoint: "https://<account_id>.eu.r2.cloudflarestorage.com",
	credentials: {
		accessKeyId: "<access_key_id",
		secretAccessKey: "<access_key_secret>",
	},
	region: "auto",
});
await S3.send(
	new CreateBucketCommand({
		Bucket: "YOUR_BUCKET_NAME",
	}),
);
```

Refer to [Examples](/r2/examples/) for additional examples from other S3 SDKs.

### Available jurisdictions

The following jurisdictions are supported:

| Jurisdiction | Jurisdiction description |
| ------------ | ------------------------ |
| eu           | European Union           |
| fedramp      | FedRAMP                  |

:::note

Cloudflare Enterprise customers may contact their account team or [Cloudflare Support](/support/contacting-cloudflare-support/) to get access to the FedRAMP jurisdiction.
:::

### Limitations

The following services do not interact with R2 resources with assigned jurisdictions:

- [Super Slurper](/r2/data-migration/) (_coming soon_)
- [Logpush](/logs/get-started/enable-destinations/r2/). As a workaround to this limitation, you can set up a [Logpush job using an S3-compatible endpoint](/data-localization/how-to/r2/#send-logs-to-r2-via-s3-compatible-endpoint) to store logs in an R2 bucket in the jurisdiction of your choice.

### Additional considerations

Once an R2 bucket is created, the jurisdiction cannot be changed.

---

# Data security

URL: https://developers.cloudflare.com/r2/reference/data-security/

This page details the data security properties of R2, including encryption-at-rest (EAR), encryption-in-transit (EIT), and Cloudflare's compliance certifications.

## Encryption at Rest

All objects stored in R2, including their metadata, are encrypted at rest. Encryption and decryption are automatic, do not require user configuration to enable, and do not impact the effective performance of R2.

Encryption keys are managed by Cloudflare and securely stored in the same key management systems we use for managing encrypted data across Cloudflare internally.

Objects are encrypted using [AES-256](https://www.cloudflare.com/learning/ssl/what-is-encryption/), a widely tested, highly performant and industry-standard encryption algorithm. R2 uses GCM (Galois/Counter Mode) as its preferred mode.

## Encryption in Transit

Data transfer between a client and R2 is secured using the same [Transport Layer Security](https://www.cloudflare.com/learning/ssl/transport-layer-security-tls/) (TLS/SSL) supported on all Cloudflare domains.

Access over plaintext HTTP (without TLS/SSL) can be disabled by connecting a [custom domain](/r2/buckets/public-buckets/#custom-domains) to your R2 bucket and enabling [Always Use HTTPS](/ssl/edge-certificates/additional-options/always-use-https/).

:::note


R2 custom domains use Cloudflare for SaaS certificates and cannot be customized. Even if you have [Advanced Certificate Manager](/ssl/edge-certificates/advanced-certificate-manager/), the advanced certificate will not be used due to [certificate prioritization](/ssl/reference/certificate-and-hostname-priority/).


:::

## Compliance

To learn more about Cloudflare's adherence to industry-standard security compliance certifications, visit the Cloudflare [Trust Hub](https://www.cloudflare.com/trust-hub/compliance-resources/).

---

# Durability

URL: https://developers.cloudflare.com/r2/reference/durability/

R2 was designed for data durability and resilience and provides 99.999999999% (eleven 9s) of annual durability, which describes the likelihood of data loss.

For example, if you store 1,000,000 objects on R2, you can expect to lose an object once every 100,000 years, which is the same level of durability as other major providers.

:::caution


Keep in mind that if you accidentally delete an object, you are responsible for implementing your own solution for backups.


:::

---

# Reference

URL: https://developers.cloudflare.com/r2/reference/

import { DirectoryListing } from "~/components";

<DirectoryListing />

---

# Unicode interoperability

URL: https://developers.cloudflare.com/r2/reference/unicode-interoperability/

R2 is built on top of Workers and supports Unicode natively. One nuance of Unicode that is often overlooked is the issue of [filename interoperability](https://en.wikipedia.org/wiki/Filename#Encoding_indication_interoperability) due to [Unicode equivalence](https://en.wikipedia.org/wiki/Unicode_equivalence).

Based on feedback from our users, we have chosen to NFC-normalize key names before storing by default. This means that `Héllo` and `Héllo`, for example, are the same object in R2 but different objects in other storage providers. Although `Héllo` and `Héllo` may be different character byte sequences, they are rendered the same.

R2 preserves the encoding for display though. When you list the objects, you will get back the last encoding you uploaded with.

There are still some platform-specific differences to consider:

* Windows and macOS filenames are case-insensitive while R2 and Linux are not.
* Windows console support for Unicode can be error-prone. Make sure to run `chcp 65001` before using command-line tools or use Cygwin if your object names appear to be incorrect.
* Linux allows distinct files that are unicode-equivalent because filenames are byte streams. Unicode-equivalent filenames on Linux will point to the same R2 object.

If it is important for you to be able to bypass the unicode equivalence and use byte-oriented key names, contact your Cloudflare account team.

---

# Protect an R2 Bucket with Cloudflare Access

URL: https://developers.cloudflare.com/r2/tutorials/cloudflare-access/

import { Render } from "~/components";

You can secure access to R2 buckets using [Cloudflare Access](/cloudflare-one/applications/configure-apps/).

Access allows you to only allow specific users, groups or applications within your organization to access objects within a bucket, or specific sub-paths, based on policies you define.

:::note

For providing secure access to bucket objects for anonymous users, we recommend using [pre-signed URLs](/r2/api/s3/presigned-urls/) instead.

Pre-signed URLs do not require users to be a member of your organization and enable programmatic application directly.

:::

## 1. Create a bucket

_If you have an existing R2 bucket, you can skip this step._

You will need to create an R2 bucket. Follow the [R2 get started guide](/r2/get-started/) to create a bucket before returning to this guide.

## 2. Create an Access application

Within the **Zero Trust** section of the Cloudflare Dashboard, you will need to create an Access application and a policy to restrict access to your R2 bucket.

If you have not configured Cloudflare Access before, we recommend:

- Configuring an [identity provider](/cloudflare-one/identity/) first to enable Access to use your organization's single-sign on (SSO) provider as an authentication method.

To create an Access application for your R2 bucket:

1. Go to [**Access**](https://one.dash.cloudflare.com/?to=/:account/access/apps) and select **Add an application**
2. Select **Self-hosted**.
3. Enter an **Application name**.
4. Select **Add a public hostname** and enter the application domain. The **Domain** must be a domain hosted on Cloudflare, and the **Subdomain** part of the custom domain you will connect to your R2 bucket. For example, if you want to serve files from `behind-access.example.com` and `example.com` is a domain within your Cloudflare account, then enter `behind-access` in the subdomain field and select `example.com` from the **Domain** list.
5. Add [Access policies](/cloudflare-one/policies/access/) to control who can connect to your application. This should be an **Allow** policy so that users can access objects within the bucket behind this Access application.

   :::note
   Ensure that your policies only allow the users within your organization that need access to this R2 bucket.
   :::

6. Follow the remaining [self-hosted application creation steps](/cloudflare-one/applications/configure-apps/self-hosted-public-app/) to publish the application.

## 3. Connect a custom domain

:::caution

You should create an Access application before connecting a custom domain to your bucket, as connecting a custom domain will otherwise make your bucket public by default.

:::

You will need to [connect a custom domain](/r2/buckets/public-buckets/#connect-a-bucket-to-a-custom-domain) to your bucket in order to configure it as an Access application. Make sure the custom domain **is the same domain** you entered when configuring your Access policy.

<Render file="custom-domain-steps" />

## 4. Test your Access policy

Visit the custom domain you connected to your R2 bucket, which should present a Cloudflare Access authentication page with your selected identity provider(s) and/or authentication methods.

For example, if you connected Google and/or GitHub identity providers, you can log in with those providers. If the login is successful and you pass the Access policies configured in this guide, you will be able to access (read/download) objects within the R2 bucket.

If you cannot authenticate or receive a block page after authenticating, check that you have an [Access policy](/cloudflare-one/applications/configure-apps/self-hosted-public-app/#1-add-your-application-to-access) configured within your Access application that explicitly allows the group your user account is associated with.

## Next steps

- Learn more about [Access applications](/cloudflare-one/applications/configure-apps/) and how to configure them.
- Understand how to use [pre-signed URLs](/r2/api/s3/presigned-urls/) to issue time-limited and prefix-restricted access to objects for users not within your organization.
- Review the [documentation on using API tokens to authenticate](/r2/api/tokens/) against R2 buckets.

---

# Tutorials

URL: https://developers.cloudflare.com/r2/tutorials/

import { GlossaryTooltip, ListTutorials, YouTubeVideos } from "~/components";

View <GlossaryTooltip term="tutorial">tutorials</GlossaryTooltip> to help you get started with R2.

## Docs

<ListTutorials />

## Videos

<YouTubeVideos products={["R2"]} />

---

# Mastodon

URL: https://developers.cloudflare.com/r2/tutorials/mastodon/

[Mastodon](https://joinmastodon.org/) is a popular [fediverse](https://en.wikipedia.org/wiki/Fediverse) software. This guide will explain how to configure R2 to be the object storage for a self hosted Mastodon instance, for either [a new instance](#set-up-a-new-instance) or [an existing instance](#migrate-to-r2).

## Set up a new instance

You can set up a self hosted Mastodon instance in multiple ways. Refer to the [official documentation](https://docs.joinmastodon.org/) for more details. When you reach the [Configuring your environment](https://docs.joinmastodon.org/admin/config/#files) step in the Mastodon documentation after installation, refer to the procedures below for the next steps.

### 1. Determine the hostname to access files

Different from the default hostname of your Mastodon instance, object storage for files requires a unique hostname. As an example, if you set up your Mastodon's hostname to be `mastodon.example.com`, you can use `mastodon-files.example.com` or `files.example.com` for accessing files. This means that when visiting your instance on `mastodon.example.com`, whenever there are media attached to a post such as an image or a video, the file will be served under the hostname determined at this step, such as `mastodon-files.example.com`.

:::note


If you move from R2 to another S3 compatible service later on, you can continue using the same hostname determined in this step. We do not recommend changing the hostname after the instance has been running to avoid breaking historical file references. In such a scenario, [Bulk Redirects](/rules/url-forwarding/bulk-redirects/) can be used to instruct requests reaching the previous hostname to refer to the new hostname.


:::

### 2. Create and set up an R2 bucket

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com/?account=r2).
2. From **Account Home**, select **R2**.
3. From **R2**, select **Create bucket**.
4. Enter your bucket name and then select **Create bucket**. This name is internal when setting up your Mastodon instance and is not publicly accessible.
5. Once the bucket is created, navigate to the **Settings** tab of this bucket and copy the value of **S3 API**.
6. From the **Settings** tab, select **Connect Domain** and enter the hostname from step 1.
7. Navigate back to the R2's overview page and select **Manage R2 API Tokens**.
8. Select **Create API token**.
9. Name your token `Mastodon` by selecting the pencil icon next to the API name and grant it the **Edit** permission. Select **Create API Token** to finalize token creation.
10. Copy the values of **Access Key ID** and **Secret Access Key**.

### 3. Configure R2 for Mastodon

While configuring your Mastodon instance based on the official [configuration file](https://github.com/mastodon/mastodon/blob/main/.env.production.sample), replace the **File storage** section with the following details.

```
S3_ENABLED=true
S3_ALIAS_HOST={{mastodon-files.example.com}}                  # Change to the hostname determined in step 1
S3_BUCKET={{your-bucket-name}}                                # Change to the bucket name set in step 2
S3_ENDPOINT=https://{{unique-id}}.r2.cloudflarestorage.com/   # Change the {{unique-id}} to the part of S3 API retrieved in step 2
AWS_ACCESS_KEY_ID={{your-access-key-id}}                      # Change to the Access Key ID retrieved in step 2
AWS_SECRET_ACCESS_KEY={{your-secret-access-key}}              # Change to the Secret Access Key retrieved in step 2
S3_PROTOCOL=https
S3_PERMISSION=private
```

After configuration, you can run your instance. After the instance is running, upload a media attachment and verify the attachment is retrieved from the hostname set above. When navigating back to the bucket's page in R2, you should see the following structure.

![Mastodon bucket structure after instance is set up and running](~/assets/images/r2/mastodon-r2-bucket-structure.png)

## Migrate to R2

If you already have an instance running, you can migrate the media files to R2 and benefit from [no egress cost](/r2/pricing/).

### 1. Set up an R2 bucket and start file migration

1. (Optional) To minimize the number of migrated files, you can use the [Mastodon admin CLI](https://docs.joinmastodon.org/admin/tootctl/#media) to clean up unused files.
2. Set up an R2 bucket ready for file migration by following steps 1 and 2 from [Setting up a new instance](#set-up-a-new-instance) section above.
3. Migrate all the media files to R2. Refer to the [examples](/r2/examples/) provided to connect various providers together. If you currently host these media files locally, you can use [`rclone`](/r2/examples/rclone/) to upload these local files to R2.

### 2. (Optional) Set up file path redirects

While the file migration is in progress, which may take a while, you can prepare file path redirect settings.

If you had the media files hosted locally, you will likely need to set up redirects. By default, media files hosted locally would have a path similar to `https://mastodon.example.com/cache/...`, which needs to be redirected to a path similar to `https://mastodon-files.example.com/cache/...` after the R2 bucket is up and running alongside your Mastodon instance. If you already use another S3 compatible object storage service and would like to keep the same hostname, you do not need to set up redirects.

[Bulk Redirects](/rules/url-forwarding/bulk-redirects/) are available for all plans. Refer to [Create Bulk Redirects in the dashboard](/rules/url-forwarding/bulk-redirects/create-dashboard/) for more information.

![List of Source URLs and their new Target URLs as part of Bulk Redirects](~/assets/images/r2/mastodon-r2-bulk-redirects.png)

### 3. Verify bucket and redirects

Depending on your migration plan, you can verify if the bucket is accessible publicly and the redirects work correctly. To verify, open an existing uploaded media file with a path like `https://mastodon.example.com/cache/...` and replace the hostname from `mastodon.example.com` to `mastocon-files.example.com` and visit the new path. If the file opened correctly, proceed to the final step.

### 4. Finalize migration

Your instance may be still running during migration, and during migration, you likely have new media files created either through direct uploads or fetched from other federated instances. To upload only the newly created files, you can use a program like [`rclone`](/r2/examples/rclone/). Note that when re-running the sync program, all existing files will be checked using at least [Class B operations](/r2/pricing/#class-b-operations).

Once all the files are synced, you can restart your Mastodon instance with the new object storage configuration as mentioned in [step 3](#3-configure-r2-for-mastodon) of Set up a new instance.

---

# Postman

URL: https://developers.cloudflare.com/r2/tutorials/postman/

Postman is an API platform that makes interacting with APIs easier. This guide will explain how to use Postman to make authenticated R2 requests to create a bucket, upload a new object, and then retrieve the object. The R2 [Postman collection](https://www.postman.com/cloudflare-r2/workspace/cloudflare-r2/collection/20913290-14ddd8d8-3212-490d-8647-88c9dc557659?action=share\&creator=20913290) includes a complete list of operations supported by the platform.

## 1. Purchase R2

This guide assumes that you have made a Cloudflare account and purchased R2.

## 2. Explore R2 in Postman

Explore R2's publicly available [Postman collection](https://www.postman.com/cloudflare-r2/workspace/cloudflare-r2/collection/20913290-14ddd8d8-3212-490d-8647-88c9dc557659?action=share\&creator=20913290). The collection is organized into a `Buckets` folder for bucket-level operations and an `Objects` folder for object-level operations. Operations in the `Objects > Upload` folder allow for adding new objects to R2.

## 3. Configure your R2 credentials

In the [Postman dashboard](https://www.postman.com/cloudflare-r2/workspace/cloudflare-r2/collection/20913290-14ddd8d8-3212-490d-8647-88c9dc557659?action=share\&creator=20913290\&ctx=documentation), select the **Cloudflare R2** collection and navigate to the **Variables** tab. In **Variables**, you can set variables within the R2 collection. They will be used to authenticate and interact with the R2 platform. Remember to always select **Save** after updating a variable.

To execute basic operations, you must set the `account-id`, `r2-access-key-id`, and `r2-secret-access-key` variables in the Postman dashboard > **Variables**.

To do this:

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com/?account=r2).
2. In **Account Home**, select **R2**.
3. In **R2**, under **Manage R2 API Tokens** on the right side of the dashboard, copy your Cloudflare account ID.
4. Go back to the [Postman dashboard](https://www.postman.com/cloudflare-r2/workspace/cloudflare-r2/collection/20913290-14ddd8d8-3212-490d-8647-88c9dc557659?action=share\&creator=20913290\&ctx=documentation).
5. Set the **CURRENT VALUE** of `account-id` to your Cloudflare account ID and select **Save**.

Next, generate an R2 API token:

1. Go to the Cloudflare dashboard > **R2**.
2. On the right hand sidebar, select **Manage R2 API Tokens**.
3. Select **Create API token**.
4. Name your token **Postman** by selecting the pencil icon next to the API name and grant it the **Edit** permission.

Guard this token and the **Access Key ID** and **Secret Access Key** closely. You will not be able to review these values again after finishing this step. Anyone with this information can fully interact with all of your buckets.

After you have created your API token in the Cloudflare dashboard:

1. Go to the [Postman dashboard](https://www.postman.com/cloudflare-r2/workspace/cloudflare-r2/collection/20913290-14ddd8d8-3212-490d-8647-88c9dc557659?action=share\&creator=20913290\&ctx=documentation) > **Variables**.
2. Copy `Access Key ID` value from the Cloudflare dashboard and paste it into Postman’s `r2-access-key-id` variable value and select **Save**.
3. Copy the `Secret Access Key` value from the Cloudflare dashboard and paste it into Postman’s `r2-secret-access-key` variable value and select **Save**.

By now, you should have `account-id`, `r2-secret-access-key`, and `r2-access-key-id` set in Postman.

To verify the token:

1. In the Postman dashboard, select the **Cloudflare R2** folder dropdown arrow > **Buckets** folder dropdown arrow > **`GET`ListBuckets**.
2. Select **Send**.

The Postman collection uses AWS SigV4 authentication to complete the handshake.

You should see a `200 OK` response with a list of existing buckets. If you receive an error, ensure your R2 subscription is active and Postman variables are saved correctly.

## 4. Create a bucket

In the Postman dashboard:

1. Go to **Variables**.
2. Set the `r2-bucket` variable value as the name of your R2 bucket and select **Save**.
3. Select the **Cloudflare R2** folder dropdown arrow > **Buckets** folder dropdown arrow > **`PUT`CreateBucket** and select **Send**.

You should see a `200 OK` response. If you run the `ListBuckets` request again, your bucket will appear in the list of results.

## 5. Add an object

You will now add an object to your bucket:

1. Go to **Variables** in the Postman dashboard.
2. Set `r2-object` to `cat-pic.jpg` and select **Save**.
3. Select **Cloudflare R2** folder dropdown arrow > **Objects** folder dropdown arrow > **Multipart** folder dropdown arrow > **`PUT`PutObject** and select **Send**.
4. Go to **Body** and choose **binary** before attaching your cat picture.
5. Select **Send** to add the cat picture to your R2 bucket.

After a few seconds, you should receive a `200 OK` response.

## 6. Get an object

It only takes a few more more clicks to download our cat friend using the `GetObject` request.

1. Select the **Cloudflare R2** folder dropdown arrow > **Objects** folder dropdown arrow > **`GET`GetObject**.
2. Select **Send**.

The R2 team will keep this collection up to date as we expand R2 features set. You can explore the rest of the R2 Postman collection by experimenting with other operations.

---

# Use event notification to summarize PDF files on upload

URL: https://developers.cloudflare.com/r2/tutorials/summarize-pdf/

import { Render, PackageManagers, Details, WranglerConfig } from "~/components";

In this tutorial, you will learn how to use [event notifications](/r2/buckets/event-notifications/) to process a PDF file when it is uploaded to an R2 bucket. You will use [Workers AI](/workers-ai/) to summarize the PDF and store the summary as a text file in the same bucket.

## Prerequisites

To continue, you will need:

- A [Cloudflare account](https://dash.cloudflare.com/sign-up/workers-and-pages) with access to R2.
- Have an existing R2 bucket. Refer to [Get started tutorial for R2](/r2/get-started/#2-create-a-bucket).
- Install [`Node.js`](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm).

<Details header="Node.js version manager">
	Use a Node version manager like [Volta](https://volta.sh/) or
	[nvm](https://github.com/nvm-sh/nvm) to avoid permission issues and change
	Node.js versions. [Wrangler](/workers/wrangler/install-and-update/), discussed
	later in this guide, requires a Node version of `16.17.0` or later.
</Details>

## 1. Create a new project

You will create a new Worker project that will use [Static Assets](/workers/static-assets/) to serve the front-end of your application. A user can upload a PDF file using this front-end, which will then be processed by your Worker.

Create a new Worker project by running the following commands:

<PackageManagers
	type="create"
	pkg="cloudflare@latest"
	args={"pdf-summarizer"}
/>

    <Render
    	file="c3-post-run-steps"
    	product="workers"
    	params={{
    	category: "hello-world",
    	type: "Worker only",
    	lang: "TypeScript",
    	}}
    />

Navigate to the `pdf-summarizer` directory:

```sh frame="none"
cd pdf-summarizer
```

## 2. Create the front-end

Using Static Assets, you can serve the front-end of your application from your Worker. To use Static Assets, you need to add the required bindings to your Wrangler file.

<WranglerConfig>

```toml
[assets]
directory = "public"
```

</WranglerConfig>

Next, create a `public` directory and add an `index.html` file. The `index.html` file should contain the following HTML code:

<details>
<summary>
Select to view the HTML code
</summary>

```html
<!doctype html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>PDF Summarizer</title>
		<style>
			body {
				font-family: Arial, sans-serif;
				display: flex;
				flex-direction: column;
				min-height: 100vh;
				margin: 0;
				background-color: #fefefe;
			}
			.content {
				flex: 1;
				display: flex;
				justify-content: center;
				align-items: center;
			}
			.upload-container {
				background-color: #f0f0f0;
				padding: 20px;
				border-radius: 8px;
				box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
			}
			.upload-button {
				background-color: #4caf50;
				color: white;
				padding: 10px 15px;
				border: none;
				border-radius: 4px;
				cursor: pointer;
				font-size: 16px;
			}
			.upload-button:hover {
				background-color: #45a049;
			}
			footer {
				background-color: #f0f0f0;
				color: white;
				text-align: center;
				padding: 10px;
				width: 100%;
			}
			footer a {
				color: #333;
				text-decoration: none;
				margin: 0 10px;
			}
			footer a:hover {
				text-decoration: underline;
			}
		</style>
	</head>
	<body>
		<div class="content">
			<div class="upload-container">
				<h2>Upload PDF File</h2>
				<form id="uploadForm" onsubmit="return handleSubmit(event)">
					<input
						type="file"
						id="pdfFile"
						name="pdfFile"
						accept=".pdf"
						required
					/>
					<button type="submit" id="uploadButton" class="upload-button">
						Upload
					</button>
				</form>
			</div>
		</div>

		<footer>
			<a
				href="https://developers.cloudflare.com/r2/buckets/event-notifications/"
				target="_blank"
				>R2 Event Notification</a
			>
			<a
				href="https://developers.cloudflare.com/queues/get-started/#3-create-a-queue"
				target="_blank"
				>Cloudflare Queues</a
			>
			<a href="https://developers.cloudflare.com/workers-ai/" target="_blank"
				>Workers AI</a
			>
			<a
				href="https://github.com/harshil1712/pdf-summarizer-r2-event-notification"
				target="_blank"
				>GitHub Repo</a
			>
		</footer>

		<script>
			handleSubmit = async (event) => {
				event.preventDefault();

				// Disable the upload button and show a loading message
				const uploadButton = document.getElementById("uploadButton");
				uploadButton.disabled = true;
				uploadButton.textContent = "Uploading...";

				// get form data
				const formData = new FormData(event.target);
				const file = formData.get("pdfFile");

				if (file) {
					// call /api/upload endpoint and send the file
					await fetch("/api/upload", {
						method: "POST",
						body: formData,
					});

					event.target.reset();
				} else {
					console.log("No file selected");
				}
				uploadButton.disabled = false;
				uploadButton.textContent = "Upload";
			};
		</script>
	</body>
</html>
```

</details>

To view the front-end of your application, run the following command and navigate to the URL displayed in the terminal:

```sh
npm run dev
```

```txt output
 ⛅️ wrangler 3.80.2
-------------------

⎔ Starting local server...
[wrangler:inf] Ready on http://localhost:8787
╭───────────────────────────╮
│  [b] open a browser       │
│  [d] open devtools        │
│  [l] turn off local mode  │
│  [c] clear console        │
│  [x] to exit              │
╰───────────────────────────╯
```

When you open the URL in your browser, you will see that there is a file upload form. If you try uploading a file, you will notice that the file is not uploaded to the server. This is because the front-end is not connected to the back-end. In the next step, you will update your Worker that will handle the file upload.

## 3. Handle file upload

To handle the file upload, you will first need to add the R2 binding. In the Wrangler file, add the following code:

<WranglerConfig>

```toml
[[r2_buckets]]
binding = "MY_BUCKET"
bucket_name = "<R2_BUCKET_NAME>"
```

</WranglerConfig>

Replace `<R2_BUCKET_NAME>` with the name of your R2 bucket.

Next, update the `src/index.ts` file. The `src/index.ts` file should contain the following code:

```ts title="src/index.ts"
export default {
	async fetch(request, env, ctx): Promise<Response> {
		// Get the pathname from the request
		const pathname = new URL(request.url).pathname;

		if (pathname === "/api/upload" && request.method === "POST") {
			// Get the file from the request
			const formData = await request.formData();
			const file = formData.get("pdfFile") as File;

			// Upload the file to Cloudflare R2
			const upload = await env.MY_BUCKET.put(file.name, file);
			return new Response("File uploaded successfully", { status: 200 });
		}

		return new Response("incorrect route", { status: 404 });
	},
} satisfies ExportedHandler<Env>;
```

The above code does the following:

- Check if the request is a POST request to the `/api/upload` endpoint. If it is, it gets the file from the request and uploads it to Cloudflare R2 using the [Workers API](/r2/api/workers/).
- If the request is not a POST request to the `/api/upload` endpoint, it returns a 404 response.

Since the Worker code is written in TypeScript, you should run the following command to add the necessary type definitions. While this is not required, it will help you avoid errors.

<Render file="request-dot-clone-warning" product="workers" />

```sh
npm run cf-typegen
```

You can restart the developer server to test the changes:

```sh
npm run dev
```

## 4. Create a queue

:::note

You will need a [Workers Paid plan](/workers/platform/pricing/) to create and use [Queues](/queues/) and Cloudflare Workers to consume event notifications.

:::

Event notifications capture changes to data in your R2 bucket. You will need to create a new queue `pdf-summarize` to receive notifications:

```sh
npx wrangler queues create pdf-summarizer
```

Add the binding to the Wrangler file:

<WranglerConfig>

```toml title="wrangler.toml"
[[queues.consumers]]
queue = "pdf-summarizer"
```

</WranglerConfig>

## 5. Handle event notifications

Now that you have a queue to receive event notifications, you need to update the Worker to handle the event notifications. You will need to add a Queue handler that will extract the textual content from the PDF, use Workers AI to summarize the content, and then save it in the R2 bucket.

Update the `src/index.ts` file to add the Queue handler:

```ts title="src/index.ts"
export default {
	async fetch(request, env, ctx): Promise<Response> {
		// No changes in the fetch handler
	},
	async queue(batch, env) {
		for (let message of batch.messages) {
			console.log(`Processing the file: ${message.body.object.key}`);
		}
	},
} satisfies ExportedHandler<Env>;
```

The above code does the following:

- The `queue` handler is called when a new message is added to the queue. It loops through the messages in the batch and logs the name of the file.

For now the `queue` handler is not doing anything. In the next steps, you will update the `queue` handler to extract the textual content from the PDF, use Workers AI to summarize the content, and then add it to the bucket.

## 6. Extract the textual content from the PDF

To extract the textual content from the PDF, the Worker will use the [unpdf](https://github.com/unjs/unpdf) library. The `unpdf` library provides utilities to work with PDF files.

Install the `unpdf` library by running the following command:

<PackageManagers pkg="unpdf" />

Update the `src/index.ts` file to import the required modules from the `unpdf` library:

```ts title="src/index.ts" ins={1}
import { extractText, getDocumentProxy } from "unpdf";
```

Next, update the `queue` handler to extract the textual content from the PDF:

```ts title="src/index.ts" ins={4-15}
async queue(batch, env) {
  for(let message of batch.messages) {
    console.log(`Processing file: ${message.body.object.key}`);
    // Get the file from the R2 bucket
    const file = await env.MY_BUCKET.get(message.body.object.key);
    if (!file) {
				console.error(`File not found: ${message.body.object.key}`);
				continue;
			}
    // Extract the textual content from the PDF
    const buffer = await file.arrayBuffer();
    const document = await getDocumentProxy(new Uint8Array(buffer));

    const {text} = await extractText(document, {mergePages: true});
    console.log(`Extracted text: ${text.substring(0, 100)}...`);
    }
}
```

The above code does the following:

- The `queue` handler gets the file from the R2 bucket.
- The `queue` handler extracts the textual content from the PDF using the `unpdf` library.
- The `queue` handler logs the textual content.

## 7. Use Workers AI to summarize the content

To use Workers AI, you will need to add the Workers AI binding to the Wrangler file. The Wrangler file should contain the following code:

<WranglerConfig>

```toml title="wrangler.toml"
[ai]
binding = "AI"
```

</WranglerConfig>

Execute the following command to add the AI type definition:

```sh
npm run cf-typegen
```

Update the `src/index.ts` file to use Workers AI to summarize the content:

```ts title="src/index.ts" ins={7-15}
async queue(batch, env) {
  for(let message of batch.messages) {
    // Extract the textual content from the PDF
    const {text} = await extractText(document, {mergePages: true});
    console.log(`Extracted text: ${text.substring(0, 100)}...`);

    // Use Workers AI to summarize the content
    const result: AiSummarizationOutput = await env.AI.run(
    "@cf/facebook/bart-large-cnn",
      {
        input_text: text,
      }
    );
    const summary = result.summary;
    console.log(`Summary: ${summary.substring(0, 100)}...`);
  }
}
```

The `queue` handler now uses Workers AI to summarize the content.

## 8. Add the summary to the R2 bucket

Now that you have the summary, you need to add it to the R2 bucket. Update the `src/index.ts` file to add the summary to the R2 bucket:

```ts title="src/index.ts" ins={8-14}
async queue(batch, env) {
  for(let message of batch.messages) {
    // Extract the textual content from the PDF
    // ...
    // Use Workers AI to summarize the content
    // ...

    // Add the summary to the R2 bucket
    const upload = await env.MY_BUCKET.put(`${message.body.object.key}-summary.txt`, summary, {
					httpMetadata: {
						contentType: 'text/plain',
					},
		});
		console.log(`Summary added to the R2 bucket: ${upload.key}`);
  }
}
```

The queue handler now adds the summary to the R2 bucket as a text file.

## 9. Enable event notifications

Your `queue` handler is ready to handle incoming event notification messages. You need to enable event notifications with the [`wrangler r2 bucket notification create` command](/workers/wrangler/commands/#r2-bucket-notification-create) for your bucket. The following command creates an event notification for the `object-create` event type for the `pdf` suffix:

```sh
npx wrangler r2 bucket notification create <R2_BUCKET_NAME> --event-type object-create --queue pdf-summarizer --suffix "pdf"
```

Replace `<R2_BUCKET_NAME>` with the name of your R2 bucket.

An event notification is created for the `pdf` suffix. When a new file with the `pdf` suffix is uploaded to the R2 bucket, the `pdf-summarizer` queue is triggered.

## 10. Deploy your Worker

To deploy your Worker, run the [`wrangler deploy`](/workers/wrangler/commands/#deploy) command:

```sh
npx wrangler deploy
```

In the output of the `wrangler deploy` command, copy the URL. This is the URL of your deployed application.

## 11. Test

To test the application, navigate to the URL of your deployed application and upload a PDF file. Alternatively, you can use the [Cloudflare dashboard](https://dash.cloudflare.com/) to upload a PDF file.

To view the logs, you can use the [`wrangler tail`](/workers/wrangler/commands/#tail) command.

```sh
npx wrangler tail
```

You will see the logs in your terminal. You can also navigate to the Cloudflare dashboard and view the logs in the Workers Logs section.

If you check your R2 bucket, you will see the summary file.

## Conclusion

In this tutorial, you learned how to use R2 event notifications to process an object on upload. You created an application to upload a PDF file, and created a consumer Worker that creates a summary of the PDF file. You also learned how to use Workers AI to summarize the content of the PDF file, and upload the summary to the R2 bucket.

You can use the same approach to process other types of files, such as images, videos, and audio files. You can also use the same approach to process other types of events, such as object deletion, and object update.

If you want to view the code for this tutorial, you can find it on [GitHub](https://github.com/harshil1712/pdf-summarizer-r2-event-notification).

---

# Log and store upload events in R2 with event notifications

URL: https://developers.cloudflare.com/r2/tutorials/upload-logs-event-notifications/

import { Render, PackageManagers, WranglerConfig } from "~/components";

This example provides a step-by-step guide on using [event notifications](/r2/buckets/event-notifications/) to capture and store R2 upload logs in a separate bucket.

![Push-Based R2 Event Notifications](~/assets/images/reference-architecture/event-notifications-for-storage/pushed-based-event-notification.svg)

## Prerequisites

To continue, you will need:

- A subscription to [Workers Paid](/workers/platform/pricing/#workers), required for using queues.

## 1. Install Wrangler

To begin, refer to [Install/Update Wrangler](/workers/wrangler/install-and-update/#install-wrangler) to install Wrangler, the Cloudflare Developer Platform CLI.

## 2. Create R2 buckets

You will need to create two R2 buckets:

- `example-upload-bucket`: When new objects are uploaded to this bucket, your [consumer Worker](/queues/get-started/#4-create-your-consumer-worker) will write logs.
- `example-log-sink-bucket`: Upload logs from `example-upload-bucket` will be written to this bucket.

To create the buckets, run the following Wrangler commands:

```sh
npx wrangler r2 bucket create example-upload-bucket
npx wrangler r2 bucket create example-log-sink-bucket
```

## 3. Create a queue

:::note

You will need a [Workers Paid plan](/workers/platform/pricing/) to create and use [Queues](/queues/) and Cloudflare Workers to consume event notifications.

:::

Event notifications capture changes to data in `example-upload-bucket`. You will need to create a new queue to receive notifications:

```sh
npx wrangler queues create example-event-notification-queue
```

## 4. Create a Worker

Before you enable event notifications for `example-upload-bucket`, you need to create a [consumer Worker](/queues/reference/how-queues-works/#create-a-consumer-worker) to receive the notifications.

Create a new Worker with C3 (`create-cloudflare` CLI). [C3](/pages/get-started/c3/) is a command-line tool designed to help you set up and deploy new applications, including Workers, to Cloudflare.

<PackageManagers
	type="create"
	pkg="cloudflare@latest"
	args={"consumer-worker"}
/>

<Render
	file="c3-post-run-steps"
	product="workers"
	params={{
		category: "hello-world",
		type: "Worker only",
		lang: "TypeScript",
	}}
/>

Then, move into your newly created directory:

```sh
cd consumer-worker
```

## 5. Configure your Worker

In your Worker project's [[Wrangler configuration file](/workers/wrangler/configuration/)](/workers/wrangler/configuration/), add a [queue consumer](/workers/wrangler/configuration/#queues) and [R2 bucket binding](/workers/wrangler/configuration/#r2-buckets). The queues consumer bindings will register your Worker as a consumer of your future event notifications and the R2 bucket bindings will allow your Worker to access your R2 bucket.

<WranglerConfig>

```toml
name = "event-notification-writer"
main = "src/index.ts"
compatibility_date = "2024-03-29"
compatibility_flags = ["nodejs_compat"]

[[queues.consumers]]
queue = "example-event-notification-queue"
max_batch_size = 100
max_batch_timeout = 5

[[r2_buckets]]
binding = "LOG_SINK"
bucket_name = "example-log-sink-bucket"
```

</WranglerConfig>

## 6. Write event notification messages to R2

Add a [`queue` handler](/queues/configuration/javascript-apis/#consumer) to `src/index.ts` to handle writing batches of notifications to our log sink bucket (you do not need a [fetch handler](/workers/runtime-apis/handlers/fetch/)):

```ts
export interface Env {
	LOG_SINK: R2Bucket;
}

export default {
	async queue(batch, env): Promise<void> {
		const batchId = new Date().toISOString().replace(/[:.]/g, "-");
		const fileName = `upload-logs-${batchId}.json`;

		// Serialize the entire batch of messages to JSON
		const fileContent = new TextEncoder().encode(
			JSON.stringify(batch.messages),
		);

		// Write the batch of messages to R2
		await env.LOG_SINK.put(fileName, fileContent, {
			httpMetadata: {
				contentType: "application/json",
			},
		});
	},
} satisfies ExportedHandler<Env>;
```

## 7. Deploy your Worker

To deploy your consumer Worker, run the [`wrangler deploy`](/workers/wrangler/commands/#deploy) command:

```sh
npx wrangler deploy
```

## 8. Enable event notifications

Now that you have your consumer Worker ready to handle incoming event notification messages, you need to enable event notifications with the [`wrangler r2 bucket notification create` command](/workers/wrangler/commands/#r2-bucket-notification-create) for `example-upload-bucket`:

```sh
npx wrangler r2 bucket notification create example-upload-bucket --event-type object-create --queue example-event-notification-queue
```

## 9. Test

Now you can test the full end-to-end flow by uploading an object to `example-upload-bucket` in the Cloudflare dashboard. After you have uploaded an object, logs will appear in `example-log-sink-bucket` in a few seconds.

---

# S3 API compatibility

URL: https://developers.cloudflare.com/r2/api/s3/api/

import { Details } from "~/components";

R2 implements the S3 API to allow users and their applications to migrate with ease. When comparing to AWS S3, Cloudflare has removed some API operations' features and added others. The S3 API operations are listed below with their current implementation status. Feature implementation is currently in progress. Refer back to this page for updates.
The API is available via the `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` endpoint. Find your [account ID in the Cloudflare dashboard](/fundamentals/account/find-account-and-zone-ids/).

## How to read this page

This page has two sections: bucket-level operations and object-level operations.

Each section will have two tables: a table of implemented APIs and a table of unimplemented APIs.

Refer the feature column of each table to review which features of an API have been implemented and which have not.

✅ Feature Implemented <br/>
🚧 Feature Implemented (Experimental) <br/>
❌ Feature Not Implemented

## Bucket region

When using the S3 API, the region for an R2 bucket is `auto`. For compatibility with tools that do not allow you to specify a region, an empty value and `us-east-1` will alias to the `auto` region.

This also applies to the `LocationConstraint` for the `CreateBucket` API.

## Bucket-level operations

The following tables are related to bucket-level operations.

### Implemented bucket-level operations

Below is a list of implemented bucket-level operations. Refer to the Feature column to review which features have been implemented (✅) and have not been implemented (❌).

| API Name                                                                                                                       | Feature                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅ [ListBuckets](https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListBuckets.html)                                         |                                                                                                                                                                                                                                                                                                                               |
| ✅ [HeadBucket](https://docs.aws.amazon.com/AmazonS3/latest/API/API_HeadBucket.html)                                           | ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                       |
| ✅ [CreateBucket](https://docs.aws.amazon.com/AmazonS3/latest/API/API_CreateBucket.html)                                       | ❌ ACL: <br/>   ❌ x-amz-acl <br/>   ❌ x-amz-grant-full-control <br/>   ❌ x-amz-grant-read <br/>   ❌ x-amz-grant-read-acp <br/>   ❌ x-amz-grant-write <br/>   ❌ x-amz-grant-write-acp <br/> ❌ Object Locking: <br/>   ❌ x-amz-bucket-object-lock-enabled <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner |
| ✅ [DeleteBucket](https://docs.aws.amazon.com/AmazonS3/latest/API/API_DeleteBucket.html)                                       | ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                       |
| ✅ [DeleteBucketCors](https://docs.aws.amazon.com/AmazonS3/latest/API/API_DeleteBucketCors.html)                               | ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                       |
| ✅ [GetBucketCors](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetBucketCors.html)                                     | ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                       |
| ✅ [GetBucketLifecycleConfiguration](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetBucketLifecycleConfiguration.html) | ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                       |
| ✅ [GetBucketLocation](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetBucketLocation.html)                             | ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                       |
| ✅ [GetBucketEncryption](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetBucketEncryption.html)                         | ❌ Bucket Owner: <br/> ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                         |
| ✅ [PutBucketCors](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutBucketCors.html)                                     | ❌ Checksums: <br/>   ❌ x-amz-sdk-checksum-algorithm <br/>   ❌ x-amz-checksum-algorithm <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                       |
| ✅ [PutBucketLifecycleConfiguration](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutBucketLifecycleConfiguration.html) | ❌ Checksums: <br/>   ❌ x-amz-sdk-checksum-algorithm <br/>   ❌ x-amz-checksum-algorithm <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                       |

### Unimplemented bucket-level operations

<Details header="Unimplemented bucket-level operations">

| API Name                                                                                                                                             | Feature                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ❌ [GetBucketAccelerateConfiguration](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetBucketAccelerateConfiguration.html)                     | ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                                     |
| ❌ [GetBucketAcl](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetBucketAcl.html)                                                             | ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                                     |
| ❌ [GetBucketAnalyticsConfiguration](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetBucketAnalyticsConfiguration.html)                       | ❌ id <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                         |
| ❌ [GetBucketIntelligentTieringConfiguration](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetBucketIntelligentTieringConfiguration.html)     | ❌ id                                                                                                                                                                                                                                                                                                                                       |
| ❌ [GetBucketInventoryConfiguration](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetBucketInventoryConfiguration.html)                       | ❌ id <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                         |
| ❌ [GetBucketLifecycle](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetBucketLifecycle.html)                                                 | ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                                     |
| ❌ [GetBucketLogging](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetBucketLogging.html)                                                     | ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                                     |
| ❌ [GetBucketMetricsConfiguration](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetBucketMetricsConfiguration.html)                           | ❌ id <br/>❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                          |
| ❌ [GetBucketNotification](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetBucketNotification.html)                                           | ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                                     |
| ❌ [GetBucketNotificationConfiguration](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetBucketNotificationConfiguration.html)                 | ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                                     |
| ❌ [GetBucketOwnershipControls](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetBucketOwnershipControls.html)                                 | ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                                     |
| ❌ [GetBucketPolicy](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetBucketPolicy.html)                                                       | ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                                     |
| ❌ [GetBucketPolicyStatus](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetBucketPolicyStatus.html)                                           | ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                                     |
| ❌ [GetBucketReplication](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetBucketReplication.html)                                             | ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                                     |
| ❌ [GetBucketRequestPayment](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetBucketRequestPayment.html)                                       | ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                                     |
| ❌ [GetBucketTagging](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetBucketTagging.html)                                                     | ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                                     |
| ❌ [GetBucketVersioning](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetBucketVersioning.html)                                               | ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                                     |
| ❌ [GetBucketWebsite](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetBucketWebsite.html)                                                     | ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                                     |
| ❌ [GetObjectLockConfiguration](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObjectLockConfiguration.html)                                 | ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                                     |
| ❌ [GetPublicAccessBlock](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetPublicAccessBlock.html)                                             | ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                                     |
| ❌ [ListBucketAnalyticsConfigurations](https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListBucketAnalyticsConfigurations.html)                   | ❌ Query Parameters: <br/>   ❌ continuation-token <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                            |
| ❌ [ListBucketIntelligentTieringConfigurations](https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListBucketIntelligentTieringConfigurations.html) | ❌ Query Parameters: <br/>   ❌ continuation-token <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                            |
| ❌ [ListBucketInventoryConfigurations](https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListBucketInventoryConfigurations.html)                   | ❌ Query Parameters: <br/>   ❌ continuation-token <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                            |
| ❌ [ListBucketMetricsConfigurations](https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListBucketMetricsConfigurations.html)                       | ❌ Query Parameters: <br/>   ❌ continuation-token <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                            |
| ❌ [PutBucketAccelerateConfiguration](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutBucketAccelerateConfiguration.html)                     | ❌ Checksums: <br/>   ❌ x-amz-checksum-algorithm <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                             |
| ❌ [PutBucketAcl](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutBucketAcl.html)                                                             | ❌ Permissions: <br/>   ❌ x-amz-grant-full-control <br/>   ❌ x-amz-grant-read <br/>   ❌ x-amz-grant-read-acp <br/>   ❌ x-amz-grant-write <br/>   ❌ x-amz-grant-write-acp <br/> ❌ Checksums: <br/>   ❌ x-amz-sdk-checksum-algorithm <br/>   ❌ x-amz-checksum-algorithm <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner |
| ❌ [PutBucketAnalyticsConfiguration](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutBucketAnalyticsConfiguration.html)                       | ❌ id <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                         |
| ❌ [PutBucketEncryption](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutBucketEncryption.html)                                               | ❌ Checksums: <br/>   ❌ x-amz-sdk-checksum-algorithm <br/>   ❌ x-amz-checksum-algorithm <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                     |
| ❌ [PutBucketIntelligentTieringConfiguration](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutBucketIntelligentTieringConfiguration.html)     | ❌ id <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                         |
| ❌ [PutBucketInventoryConfiguration](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutBucketInventoryConfiguration.html)                       | ❌ id <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                         |
| ❌ [PutBucketLifecycle](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutBucketLifecycle.html)                                                 | ❌ Checksums: <br/>   ❌ x-amz-sdk-checksum-algorithm <br/>   ❌ x-amz-checksum-algorithm <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                     |
| ❌ [PutBucketLogging](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutBucketLifecycle.html)                                                   | ❌ Checksums: <br/>   ❌ Content-MD5 <br/>   ❌ x-amz-sdk-checksum-algorithm <br/>   ❌ x-amz-checksum-algorithm <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                              |
| ❌ [PutBucketMetricsConfiguration](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutBucketMetricsConfiguration.html)                           | ❌ id <br/>❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                          |
| ❌ [PutBucketNotification](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutBucketNotification.html)                                           | ❌ Checksums: <br/>   ❌ Content-MD5 <br/>   ❌ x-amz-sdk-checksum-algorithm <br/>   ❌ x-amz-checksum-algorithm <br/> ❌ Bucket Owner:   <br/> ❌ x-amz-expected-bucket-owner                                                                                                                                                              |
| ❌ [PutBucketNotificationConfiguration](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutBucketNotificationConfiguration.html)                 | ❌ Validation: <br/>   ❌ x-amz-skip-destination-validation <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                   |
| ❌ [PutBucketOwnershipControls](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutBucketOwnershipControls.html)                                 | ❌ Checksums: <br/>   ❌ Content-MD5 <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                          |
| ❌ [PutBucketPolicy](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutBucketPolicy.html)                                                       | ❌ Validation: <br/>   ❌ x-amz-confirm-remove-self-bucket-access <br/> ❌ Checksums: <br/>   ❌ Content-MD5 <br/>   ❌ x-amz-sdk-checksum-algorithm <br/>   ❌ x-amz-checksum-algorithm <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                      |
| ❌ [PutBucketReplication](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutBucketReplication.html)                                             | ❌ Object Locking: <br/>   ❌ x-amz-bucket-object-lock-token <br/> ❌ Checksums: <br/>   ❌ Content-MD5 <br/>   ❌ x-amz-sdk-checksum-algorithm <br/>   ❌ x-amz-checksum-algorithm <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                           |
| ❌ [PutBucketRequestPayment](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutBucketRequestPayment.html)                                       | ❌ Checksums: <br/>   ❌ Content-MD5 <br/>   ❌ x-amz-sdk-checksum-algorithm <br/>   ❌ x-amz-checksum-algorithm <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                              |
| ❌ [PutBucketTagging](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutBucketTagging.html)                                                     | ❌ Checksums: <br/>   ❌ Content-MD5 <br/>   ❌ x-amz-sdk-checksum-algorithm <br/>   ❌ x-amz-checksum-algorithm <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                              |
| ❌ [PutBucketVersioning](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutBucketVersioning.html)                                               | ❌ Multi-factor authentication: <br/>   ❌ x-amz-mfa <br/> ❌ Checksums: <br/>   ❌ Content-MD5 <br/>   ❌ x-amz-sdk-checksum-algorithm <br/>   ❌ x-amz-checksum-algorithm <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                   |
| ❌ [PutBucketWebsite](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutBucketWebsite.html)                                                     | ❌ Checksums: <br/>   ❌ Content-MD5 <br/> ❌ Bucket Owner: <br/> ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                            |
| ❌ [PutObjectLockConfiguration](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObjectLockConfiguration.html)                                 | ❌ Object Locking: <br/>   ❌ x-amz-bucket-object-lock-token <br/> ❌ Checksums: <br/>   ❌ Content-MD5 <br/> ❌ Request Payer: <br/>   ❌ x-amz-request-payer <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                |
| ❌ [PutPublicAccessBlock](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutPublicAccessBlock.html)                                             | ❌ Checksums: <br/>   ❌ Content-MD5 <br/>   ❌ x-amz-sdk-checksum-algorithm <br/>   ❌ x-amz-checksum-algorithm <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                              |

</Details>

## Object-level operations

The following tables are related to object-level operations.

### Implemented object-level operations

Below is a list of implemented object-level operations. Refer to the Feature column to review which features have been implemented (✅) and have not been implemented (❌).

| API Name                                                                                                       | Feature                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ✅ [HeadObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_HeadObject.html)                           | ✅ Conditional Operations: <br/>   ✅ If-Match <br/>   ✅ If-Modified-Since <br/>   ✅ If-None-Match <br/>   ✅ If-Unmodified-Since <br/> ✅ Range: <br/>   ✅ Range (has no effect in HeadObject) <br/>   ✅ partNumber <br/> ✅ SSE-C: <br/>   ✅ x-amz-server-side-encryption-customer-algorithm <br/>   ✅ x-amz-server-side-encryption-customer-key <br/>   ✅ x-amz-server-side-encryption-customer-key-MD5 <br/> ❌ Request Payer: <br/>   ❌ x-amz-request-payer <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ✅ [ListObjects](https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListObjects.html)                         | Query Parameters: <br/>   ✅ delimiter <br/>   ✅ encoding-type <br/>   ✅ marker <br/>   ✅ max-keys <br/>   ✅ prefix <br/> ❌ Request Payer: <br/>   ❌ x-amz-request-payer <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ✅ [ListObjectsV2](https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListObjectsV2.html)                     | Query Parameters: <br/>   ✅ list-type <br/>   ✅ continuation-token <br/>   ✅ delimiter <br/>   ✅ encoding-type <br/>   ✅ fetch-owner <br/>   ✅ max-keys <br/>   ✅ prefix <br/>   ✅ start-after <br/> ❌ Request Payer: <br/>   ❌ x-amz-request-payer <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ✅ [GetObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html)                             | ✅ Conditional Operations: <br/>   ✅ If-Match <br/>   ✅ If-Modified-Since <br/>   ✅ If-None-Match <br/>   ✅ If-Unmodified-Since <br/> ✅ Range: <br/>   ✅ Range <br/>   ✅ PartNumber <br/> ✅ SSE-C: <br/>   ✅ x-amz-server-side-encryption-customer-algorithm <br/>   ✅ x-amz-server-side-encryption-customer-key <br/>   ✅ x-amz-server-side-encryption-customer-key-MD5 <br/> ❌ Request Payer: <br/>   ❌ x-amz-request-payer <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ✅ [PutObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html)                             | ✅ System Metadata: <br/>   ✅ Content-Type <br/>   ✅ Cache-Control <br/>   ✅ Content-Disposition <br/>   ✅ Content-Encoding <br/>   ✅ Content-Language <br/>   ✅ Expires <br/>   ✅ Content-MD5 <br/> ✅ Storage Class: <br/>   ✅ x-amz-storage-class <br/>     ✅ STANDARD <br/>     ✅ STANDARD_IA <br/> ❌ Object Lifecycle <br/> ❌ Website: <br/>   ❌ x-amz-website-redirect-location <br/> ❌ SSE: <br/>   ❌ x-amz-server-side-encryption-aws-kms-key-id <br/>   ❌ x-amz-server-side-encryption <br/>   ❌ x-amz-server-side-encryption-context <br/>   ❌ x-amz-server-side-encryption-bucket-key-enabled <br/> ✅ SSE-C: <br/>   ✅ x-amz-server-side-encryption-customer-algorithm <br/>   ✅ x-amz-server-side-encryption-customer-key <br/>   ✅ x-amz-server-side-encryption-customer-key-MD5 <br/> ❌ Request Payer: <br/>   ❌ x-amz-request-payer <br/> ❌ Tagging: <br/>   ❌ x-amz-tagging <br/> ❌ Object Locking: <br/>   ❌ x-amz-object-lock-mode <br/>   ❌ x-amz-object-lock-retain-until-date <br/>   ❌ x-amz-object-lock-legal-hold <br/> ❌ ACL: <br/>   ❌ x-amz-acl <br/>   ❌ x-amz-grant-full-control <br/>   ❌ x-amz-grant-read <br/>   ❌ x-amz-grant-read-acp <br/>   ❌ x-amz-grant-write-acp <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ✅ [DeleteObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_DeleteObject.html)                       | ❌ Multi-factor authentication: <br/>   ❌ x-amz-mfa <br/> ❌ Object Locking: <br/>   ❌ x-amz-bypass-governance-retention <br/> ❌ Request Payer: <br/>   ❌ x-amz-request-payer <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ✅ [DeleteObjects](https://docs.aws.amazon.com/AmazonS3/latest/API/API_DeleteObjects.html)                     | ❌ Multi-factor authentication: <br/>   ❌ x-amz-mfa <br/> ❌ Object Locking: <br/>   ❌ x-amz-bypass-governance-retention <br/> ❌ Request Payer: <br/>   ❌ x-amz-request-payer <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ✅ [ListMultipartUploads](https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListMultipartUploads.html)       | ✅ Query Parameters: <br/>   ✅ delimiter <br/>   ✅ encoding-type <br/>   ✅ key-marker <br/>   ✅️ max-uploads <br/>   ✅ prefix <br/>   ✅ upload-id-marker                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ✅ [CreateMultipartUpload](https://docs.aws.amazon.com/AmazonS3/latest/API/API_CreateMultipartUpload.html)     | ✅ System Metadata: <br/>   ✅ Content-Type <br/>   ✅ Cache-Control <br/>   ✅ Content-Disposition <br/>   ✅ Content-Encoding <br/>   ✅ Content-Language <br/>   ✅ Expires <br/>   ✅ Content-MD5 <br/> ✅ Storage Class: <br/>   ✅ x-amz-storage-class <br/>     ✅ STANDARD <br/>     ✅ STANDARD_IA <br/> ❌ Website: <br/>   ❌ x-amz-website-redirect-location <br/> ❌ SSE: <br/>   ❌ x-amz-server-side-encryption-aws-kms-key-id <br/>   ❌ x-amz-server-side-encryption <br/>   ❌ x-amz-server-side-encryption-context <br/>   ❌ x-amz-server-side-encryption-bucket-key-enabled <br/> ✅ SSE-C: <br/>   ✅ x-amz-server-side-encryption-customer-algorithm <br/>   ✅ x-amz-server-side-encryption-customer-key <br/>   ✅ x-amz-server-side-encryption-customer-key-MD5 <br/> ❌ Request Payer: <br/>   ❌ x-amz-request-payer <br/> ❌ Tagging: <br/>   ❌ x-amz-tagging <br/> ❌ Object Locking: <br/>   ❌ x-amz-object-lock-mode <br/>   ❌ x-amz-object-lock-retain-until-date <br/>   ❌ x-amz-object-lock-legal-hold <br/> ❌ ACL: <br/>   ❌ x-amz-acl <br/>   ❌ x-amz-grant-full-control <br/>   ❌ x-amz-grant-read <br/>   ❌ x-amz-grant-read-acp <br/>   ❌ x-amz-grant-write-acp <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ✅ [CompleteMultipartUpload](https://docs.aws.amazon.com/AmazonS3/latest/API/API_CompleteMultipartUpload.html) | ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner <br/> ❌ Request Payer: <br/>   ❌ x-amz-request-payer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ✅ [AbortMultipartUpload](https://docs.aws.amazon.com/AmazonS3/latest/API/API_AbortMultipartUpload.html)       | ❌ Request Payer: <br/>   ❌ x-amz-request-payer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ✅ [CopyObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_CopyObject.html)                           | ✅ Operation Metadata: <br/>   ✅ x-amz-metadata-directive <br/> ✅ System Metadata: <br/>   ✅ Content-Type <br/>   ✅ Cache-Control <br/>   ✅ Content-Disposition <br/>   ✅ Content-Encoding <br/>   ✅ Content-Language <br/>   ✅ Expires <br/> ✅ Conditional Operations: <br/>   ✅ x-amz-copy-source <br/>   ✅ x-amz-copy-source-if-match <br/>   ✅ x-amz-copy-source-if-modified-since <br/>   ✅ x-amz-copy-source-if-none-match <br/>   ✅ x-amz-copy-source-if-unmodified-since <br/> ✅ Storage Class: <br/>   ✅ x-amz-storage-class <br/>     ✅ STANDARD <br/>     ✅ STANDARD_IA <br/> ❌ ACL: <br/>   ❌ x-amz-acl <br/>   ❌ x-amz-grant-full-control <br/>   ❌ x-amz-grant-read <br/>   ❌ x-amz-grant-read-acp <br/>   ❌ x-amz-grant-write-acp <br/> ❌ Website: <br/>   ❌ x-amz-website-redirect-location <br/> ❌ SSE: <br/>   ❌ x-amz-server-side-encryption <br/>   ❌ x-amz-server-side-encryption-aws-kms-key-id <br/>   ❌ x-amz-server-side-encryption-context <br/>   ❌ x-amz-server-side-encryption-bucket-key-enabled <br/> ✅ SSE-C: <br/>   ✅ x-amz-server-side-encryption-customer-algorithm <br/>   ✅ x-amz-server-side-encryption-customer-key <br/>   ✅ x-amz-server-side-encryption-customer-key-MD5 <br/>   ✅ x-amz-copy-source-server-side-encryption-customer-algorithm <br/>   ✅ x-amz-copy-source-server-side-encryption-customer-key <br/>   ✅ x-amz-copy-source-server-side-encryption-customer-key-MD5 <br/> ❌ Request Payer: <br/>   ❌ x-amz-request-payer <br/> ❌ Tagging: <br/>   ❌ x-amz-tagging <br/>   ❌ x-amz-tagging-directive <br/> ❌ Object Locking: <br/>   ❌ x-amz-object-lock-mode <br/>   ❌ x-amz-object-lock-retain-until-date <br/>   ❌ x-amz-object-lock-legal-hold <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner <br/>   ❌ x-amz-source-expected-bucket-owner <br/> ❌ Checksums: <br/>   ❌ x-amz-checksum-algorithm |
| ✅ [UploadPart](https://docs.aws.amazon.com/AmazonS3/latest/API/API_UploadPart.html)                           | ✅ System Metadata: <br/>   ✅ Content-MD5 <br/> ❌ SSE: <br/>   ❌ x-amz-server-side-encryption <br/> ✅ SSE-C: <br/>   ✅ x-amz-server-side-encryption-customer-algorithm <br/>   ✅ x-amz-server-side-encryption-customer-key <br/>   ✅ x-amz-server-side-encryption-customer-key-MD5 <br/> ❌ Request Payer: <br/>   ❌ x-amz-request-payer <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ✅ [UploadPartCopy](https://docs.aws.amazon.com/AmazonS3/latest/API/API_UploadPartCopy.html)                   | ❌ Conditional Operations: <br/>   ❌ x-amz-copy-source <br/>   ❌ x-amz-copy-source-if-match <br/>   ❌ x-amz-copy-source-if-modified-since <br/>   ❌ x-amz-copy-source-if-none-match <br/>   ❌ x-amz-copy-source-if-unmodified-since <br/> ✅ Range: <br/>   ✅ x-amz-copy-source-range <br/> ✅ SSE-C: <br/>   ✅ x-amz-server-side-encryption-customer-algorithm <br/>   ✅ x-amz-server-side-encryption-customer-key <br/>   ✅ x-amz-server-side-encryption-customer-key-MD5 <br/>   ✅ x-amz-copy-source-server-side-encryption-customer-algorithm <br/>   ✅ x-amz-copy-source-server-side-encryption-customer-key <br/>   ✅ x-amz-copy-source-server-side-encryption-customer-key-MD5 <br/> ❌ Request Payer: <br/>   ❌ x-amz-request-payer <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner <br/>   ❌ x-amz-source-expected-bucket-owner                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ✅ [ListParts](https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListParts.html)                             | Query Parameters: <br/>   ✅ max-parts <br/>   ✅ part-number-marker <br/> ❌ Request Payer: <br/>   ❌ x-amz-request-payer <br/> ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

:::caution

Even though `ListObjects` is a supported operation, it is recommended that you use `ListObjectsV2` instead when developing applications. For more information, refer to [ListObjects](https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListObjects.html).

:::

### Unimplemented object-level operations

<Details header="Unimplemented object-level operations">

| API Name                                                                                               | Feature                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ❌ [GetObjectTagging](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObjectTagging.html)       | ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner <br/> ❌ Request Payer: <br/>   ❌ x-amz-request-payer                                                             |
| ❌ [PutObjectTagging](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObjectTagging.html)       | ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner <br/> ❌ Request Payer: <br/>   ❌ x-amz-request-payer <br/> ❌ Checksums: <br/>   ❌ x-amz-sdk-checksum-algorithm |
| ❌ [DeleteObjectTagging](https://docs.aws.amazon.com/AmazonS3/latest/API/API_DeleteObjectTagging.html) | ❌ Bucket Owner: <br/>   ❌ x-amz-expected-bucket-owner                                                                                                                    |

</Details>

---

# Extensions

URL: https://developers.cloudflare.com/r2/api/s3/extensions/

R2 implements some extensions on top of the basic S3 API. This page outlines these additional, available features. Some of the functionality described in this page requires setting a custom header. For examples on how to do so, refer to [Configure custom headers](/r2/examples/aws/custom-header).

## Extended metadata using Unicode

The [Workers R2 API](/r2/api/workers/workers-api-reference/) supports Unicode in keys and values natively without requiring any additional encoding or decoding for the `customMetadata` field. These fields map to the `x-amz-meta-`-prefixed headers used within the R2 S3-compatible API endpoint.

HTTP header names and values may only contain ASCII characters, which is a small subset of the Unicode character library. To easily accommodate users, R2 adheres to [RFC 2047](https://datatracker.ietf.org/doc/html/rfc2047) and automatically decodes all `x-amz-meta-*` header values before storage. On retrieval, any metadata values with unicode are RFC 2047-encoded before rendering the response. The length limit for metadata values is applied to the decoded Unicode value.

:::caution[Metadata variance]

Be mindful when using both Workers and S3 API endpoints to access the same data. If the R2 metadata keys contain Unicode, they are stripped when accessed through the S3 API and the `x-amz-missing-meta` header is set to the number of keys that were omitted. 
:::

These headers map to the `httpMetadata` field in the [R2 bindings](/workers/runtime-apis/bindings/):



| HTTP Header           | Property Name                     |
| --------------------- | --------------------------------- |
| `Content-Encoding`    | `httpMetadata.contentEncoding`    |
| `Content-Type`        | `httpMetadata.contentType`        |
| `Content-Language`    | `httpMetadata.contentLanguage`    |
| `Content-Disposition` | `httpMetadata.contentDisposition` |
| `Cache-Control`       | `httpMetadata.cacheControl`       |
| `Expires`             | `httpMetadata.expires`            |
|                       |                                   |

If using Unicode in object key names, refer to [Unicode Interoperability](/r2/reference/unicode-interoperability/).

## Auto-creating buckets on upload

If you are creating buckets on demand, you might initiate an upload with the assumption that a target bucket exists. In this situation, if you received a `NoSuchBucket` error, you would probably issue a `CreateBucket` operation. However, following this approach can cause issues: if the body has already been partially consumed, the upload will need to be aborted. A common solution to this issue, followed by other object storage providers, is to use the [HTTP `100`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/100) response to detect whether the body should be sent, or if the bucket must be created before retrying the upload. However, Cloudflare does not support the HTTP `100` response. Even if the HTTP `100` response was supported, you would still have additional latency due to the round trips involved.

To support sending an upload with a streaming body to a bucket that may not exist yet, upload operations such as `PutObject` or `CreateMultipartUpload` allow you to specify a header that will ensure the `NoSuchBucket` error is not returned. If the bucket does not exist at the time of upload, it is implicitly instantiated with the following `CreateBucket` request:

```txt
PUT / HTTP/1.1
Host: bucket.account.r2.cloudflarestorage.com
<CreateBucketConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
   <LocationConstraint>auto</LocationConstraint>
</CreateBucketConfiguration>
```

This is only useful if you are creating buckets on demand because you do not know the name of the bucket or the preferred access location ahead of time. For example, you have one bucket per one of your customers and the bucket is created on first upload to the bucket and not during account registration. In these cases, the [`ListBuckets` extension](#listbuckets), which supports accounts with more than 1,000 buckets, may also be useful.

## PutObject and CreateMultipartUpload

### cf-create-bucket-if-missing

Add a `cf-create-bucket-if-missing` header with the value `true` to implicitly create the bucket if it does not exist yet. Refer to [Auto-creating buckets on upload](#auto-creating-buckets-on-upload) for a more detailed explanation of when to add this header.

## PutObject

### Conditional operations in `PutObject`

`PutObject` supports [conditional uploads](https://developer.mozilla.org/en-US/docs/Web/HTTP/Conditional_requests) via the [`If-Match`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/If-Match), [`If-None-Match`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/If-None-Match), [`If-Modified-Since`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/If-Modified-Since), and [`If-Unmodified-Since`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/If-Unmodified-Since) headers. These headers will cause the `PutObject` operation to be rejected with `412 PreconditionFailed` error codes when the preceding state of the object that is being written to does not match the specified conditions.

## CopyObject

### MERGE metadata directive

The `x-amz-metadata-directive` allows a `MERGE` value, in addition to the standard `COPY` and `REPLACE` options. When used, `MERGE` is a combination of `COPY` and `REPLACE`, which will `COPY` any metadata keys from the source object and `REPLACE` those that are specified in the request with the new value. You cannot use `MERGE` to remove existing metadata keys from the source — use `REPLACE` instead.

## `ListBuckets`

`ListBuckets` supports all the same search parameters as `ListObjectsV2` in R2 because some customers may have more than 1,000 buckets. Because tooling, like existing S3 libraries, may not expose a way to set these search parameters, these values may also be sent in via headers. Values in headers take precedence over the search parameters.



| Search parameter     | HTTP Header             | Meaning                                                           |
| -------------------- | ----------------------- | ----------------------------------------------------------------- |
| `prefix`             | `cf-prefix`             | Show buckets with this prefix only.                               |
| `start-after`        | `cf-start-after`        | Show buckets whose name appears lexicographically in the account. |
| `continuation-token` | `cf-continuation-token` | Resume listing from a previously returned continuation token.     |
| `max-keys`           | `cf-max-keys`           | Return this maximum number of buckets. Default and max is `1000`. |
|                      |                         |                                                                   |

The XML response contains a `NextContinuationToken` and `IsTruncated` elements as appropriate. Since these may not be accessible from existing S3 APIs, these are also available in response headers:



| XML Response Element    | HTTP Response Header         | Meaning                                                                                        |
| ----------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `IsTruncated`           | `cf-is-truncated`            | This is set to `true` if the list of buckets returned is not all the buckets on the account.   |
| `NextContinuationToken` | `cf-next-continuation-token` | This is set to continuation token to pass on a subsequent `ListBuckets` to resume the listing. |
| `StartAfter`            |                              | This is the start-after value that was passed in on the request.                               |
| `KeyCount`              |                              | The number of buckets returned.                                                                |
| `ContinuationToken`     |                              | The continuation token that was supplied in the request.                                       |
| `MaxKeys`               |                              | The max keys that were specified in the request.                                               |
|                         |                              |                                                                                                |

### Conditional operations in `CopyObject` for the destination object

:::note

This feature is currently in beta. If you have feedback, reach out to us on the [Cloudflare Developer Discord](https://discord.cloudflare.com) in the #r2-storage channel or open a thread on the [Community Forum](https://community.cloudflare.com/c/developers/storage/81). 
:::

`CopyObject` already supports conditions that relate to the source object through the `x-amz-copy-source-if-...` headers as part of our compliance with the S3 API. In addition to this, R2 supports an R2 specific set of headers that allow the `CopyObject` operation to be conditional on the target object:

* `cf-copy-destination-if-match`
* `cf-copy-destination-if-none-match`
* `cf-copy-destination-if-modified-since`
* `cf-copy-destination-if-unmodified-since`

These headers work akin to the similarly named conditional headers supported on `PutObject`. When the preceding state of the destination object to does not match the specified conditions the `CopyObject` operation will be rejected with a `412 PreconditionFailed` error code.

#### Non-atomicity relative to `x-amz-copy-source-if`

The `x-amz-copy-source-if-...` headers are guaranteed to be checked when the source object for the copy operation is selected, and the `cf-copy-destination-if-...` headers are guaranteed to be checked when the object is committed to the bucket state.
However, the time at which the source object is selected for copying, and the point in time when the destination object is committed to the bucket state are not necessarily the same. This means that the `cf-copy-destination-if-...` headers are not atomic in relation to the `x-amz-copy-source-if...` headers.

---

# S3

URL: https://developers.cloudflare.com/r2/api/s3/

import { DirectoryListing } from "~/components";

<DirectoryListing />

---

# Presigned URLs

URL: https://developers.cloudflare.com/r2/api/s3/presigned-urls/

import {Tabs, TabItem } from "~/components";

Presigned URLs are an [S3 concept](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html) for sharing direct access to your bucket without revealing your token secret. A presigned URL authorizes anyone with the URL to perform an action to the S3 compatibility endpoint for an R2 bucket. By default, the S3 endpoint requires an `AUTHORIZATION` header signed by your token. Every presigned URL has S3 parameters and search parameters containing the signature information that would be present in an `AUTHORIZATION` header. The performable action is restricted to a specific resource, an [operation](/r2/api/s3/api/), and has an associated timeout.

There are three kinds of resources in R2:

1. **Account**: For account-level operations (such as `CreateBucket`, `ListBuckets`, `DeleteBucket`) the identifier is the account ID.
2. **Bucket**: For bucket-level operations (such as `ListObjects`, `PutBucketCors`) the identifier is the account ID, and bucket name.
3. **Object**: For object-level operations (such as `GetObject`, `PutObject`, `CreateMultipartUpload`) the identifier is the account ID, bucket name, and object path.

All parts of the identifier are part of the presigned URL.

You cannot change the resource being accessed after the request is signed. For example, trying to change the bucket name to access the same object in a different bucket will return a `403` with an error code of `SignatureDoesNotMatch`.

Presigned URLs must have a defined expiry. You can set a timeout from one second to 7 days (604,800 seconds) into the future. The URL will contain the time when the URL was generated (`X-Amz-Date`) and the timeout (`X-Amz-Expires`) as search parameters. These search parameters are signed and tampering with them will result in `403` with an error code of `SignatureDoesNotMatch`.

Presigned URLs are generated with no communication with R2 and must be generated by an application with access to your R2 bucket's credentials.

## Presigned URL use cases

There are three ways to grant an application access to R2:

1. The application has its own copy of an [R2 API token](/r2/api/tokens/).
2. The application requests a copy of an R2 API token from a vault application and promises to not permanently store that token locally.
3. The application requests a central application to give it a presigned URL it can use to perform an action.

In scenarios 1 and 2, if the application or vault application is compromised, the holder of the token can perform arbitrary actions.

Scenario 3 keeps the credential secret. If the application making a presigned URL request to the central application leaks that URL, but the central application does not have its key storage system compromised, the impact is limited to one operation on the specific resource that was signed.

Additionally, the central application can perform monitoring, auditing, logging tasks so you can review when a request was made to perform an operation on a specific resource. In the event of a security incident, you can use a central application's logging functionality to review details of the incident.

The central application can also perform policy enforcement. For example, if you have an application responsible for uploading resources, you can restrict the upload to a specific bucket or folder within a bucket. The requesting application can obtain a JSON Web Token (JWT) from your authorization service to sign a request to the central application. The central application then uses the information contained in the JWT to validate the inbound request parameters.

The central application can be, for example, a Cloudflare Worker. Worker secrets are cryptographically impossible to obtain outside of your script running on the Workers runtime. If you do not store a copy of the secret elsewhere and do not have your code log the secret somewhere, your Worker secret will remain secure. However, as previously mentioned, presigned URLs are generated outside of R2 and all that's required is the secret + an implementation of the signing algorithm, so you can generate them anywhere.

Another potential use case for presigned URLs is debugging. For example, if you are debugging your application and want to grant temporary access to a specific test object in a production environment, you can do this without needing to share the underlying token and remembering to revoke it.

## Supported HTTP methods

R2 currently supports the following methods when generating a presigned URL:

- `GET`: allows a user to fetch an object from a bucket
- `HEAD`: allows a user to fetch an object's metadata from a bucket
- `PUT`: allows a user to upload an object to a bucket
- `DELETE`: allows a user to delete an object from a bucket

`POST`, which performs uploads via native HTML forms, is not currently supported.

## Presigned URL alternative with Workers

A valid alternative design to presigned URLs is to use a Worker with a [binding](/workers/runtime-apis/bindings/) that implements your security policy.

:::note[Bindings]

A binding is how your Worker interacts with external resources such as [KV Namespaces](/kv/concepts/kv-namespaces/), [Durable Objects](/durable-objects/), or [R2 Buckets](/r2/buckets/). A binding is a runtime variable that the Workers runtime provides to your code. You can declare a variable name in your Wrangler file that will be bound to these resources at runtime, and interact with them through this variable. Every binding's variable name and behavior is determined by you when deploying the Worker. Refer to [Environment Variables](/workers/configuration/environment-variables/) for more information.

A binding is defined in the Wrangler file of your Worker project's directory.

:::

Refer to [Use R2 from Workers](/r2/api/workers/workers-api-usage/) to learn how to bind a bucket to a Worker and use the binding to interact with your bucket.

## Generate presigned URLs

Generate a presigned URL by referring to the following examples:

- [AWS SDK for Go](/r2/examples/aws/aws-sdk-go/#generate-presigned-urls)
- [AWS SDK for JS v3](/r2/examples/aws/aws-sdk-js-v3/#generate-presigned-urls)
- [AWS SDK for JS](/r2/examples/aws/aws-sdk-js/#generate-presigned-urls)
- [AWS SDK for PHP](/r2/examples/aws/aws-sdk-php/#generate-presigned-urls)
- [AWS CLI](/r2/examples/aws/aws-cli/#generate-presigned-urls)

### Example of generating presigned URLs

A possible use case may be restricting an application to only be able to upload to a specific URL. With presigned URLs, your central signing application might look like the following JavaScript code running on Cloudflare Workers, `workerd`, or another platform (you might have to update the code based on the platform you are using).

If the application received a request for `https://example.com/uploads/dog.png`, it would respond with a presigned URL allowing a user to upload to your R2 bucket at the `/uploads/dog.png` path.

To create a presigned URL, you will need to either use a package that implements the signing algorithm, or implement the signing algorithm yourself. In this example, the `aws4fetch` package is used. You also need to have an access key ID and a secret access key. Refer to [R2 API tokens](/r2/api/tokens/) for more information.

```ts
import { AwsClient } from "aws4fetch";

// Create a new client
// Replace with your own access key ID and secret access key
// Make sure to store these securely and not expose them
const client = new AwsClient({
	accessKeyId: "",
	secretAccessKey: "",
});

export default {
	async fetch(req): Promise<Response> {
		// This is just an example to demonstrating using aws4fetch to generate a presigned URL.
		// This Worker should not be used as-is as it does not authenticate the request, meaning
		// that anyone can upload to your bucket.
		//
		// Consider implementing authorization, such as a preshared secret in a request header.
		const requestPath = new URL(req.url).pathname;

		// Cannot upload to the root of a bucket
		if (requestPath === "/") {
			return new Response("Missing a filepath", { status: 400 });
		}

		// Replace with your bucket name and account ID
		const bucketName = "";
		const accountId = "";

		const url = new URL(
			`https://${bucketName}.${accountId}.r2.cloudflarestorage.com`,
		);

		// preserve the original path
		url.pathname = requestPath;

		// Specify a custom expiry for the presigned URL, in seconds
		url.searchParams.set("X-Amz-Expires", "3600");

		const signed = await client.sign(
			new Request(url, {
				method: "PUT",
			}),
			{
				aws: { signQuery: true },
			},
		);

		// Caller can now use this URL to upload to that object.
		return new Response(signed.url, { status: 200 });
	},

	// ... handle other kinds of requests
} satisfies ExportedHandler;
```

## Differences between presigned URLs and R2 binding

- When using an R2 binding, you will not need any token secrets in your Worker code. Instead, in your [Wrangler configuration file](/workers/wrangler/configuration/), you will create a [binding](/r2/api/workers/workers-api-usage/#3-bind-your-bucket-to-a-worker) to your R2 bucket. Additionally, authorization is handled in-line, which can reduce latency.
- When using presigned URLs, you will need to create and use the token secrets in your Worker code.

In some cases, R2 bindings let you implement certain functionality more easily. For example, if you wanted to offer a write-once guarantee so that users can only upload to a path once:

- With R2 binding: You only need to pass the header once.
- With presigned URLs: You need to first sign specific headers, then request the user to send the same headers.

<Tabs>
<TabItem label="R2 binding example">

If you are using R2 bindings, you would change your upload to:

```ts
const existingObject = await env.R2_BUCKET.put(key, request.body, {
	onlyIf: {
		// No objects will have been uploaded before September 28th, 2021 which
		// is the initial R2 announcement.
		uploadedBefore: new Date(1632844800000),
	},
});
if (existingObject?.etag !== request.headers.get("etag")) {
	return new Response("attempt to overwrite object", { status: 400 });
}
```

When using R2 bindings, you may need to consider the following limitations:

- You cannot upload more than 100 MiB (200 MiB for Business customers) when using R2 bindings.
- Enterprise customers can upload 500 MiB by default and can ask their account team to raise this limit.
- Detecting [precondition failures](/r2/api/s3/extensions/#conditional-operations-in-putobject) is currently easier with presigned URLs as compared with R2 bindings.

Note that these limitations depend on R2's extension for conditional uploads. Amazon's S3 service does not offer such functionality at this time.
</TabItem>
<TabItem label="Presigned URL example">
You can modify the previous example to sign additional headers:

```ts
const signed = await client.sign(
	new Request(url, {
		method: "PUT",
	}),
	{
		aws: { signQuery: true },
		headers: {
			"If-Unmodified-Since": "Tue, 28 Sep 2021 16:00:00 GMT",
		},
	},
);
```

```ts
// Use the presigned URL to upload the file
const response = await fetch(signed.url, {
	method: "PUT",
	body: file,
	headers: {
		"If-Unmodified-Since": "Tue, 28 Sep 2021 16:00:00 GMT",
	},
});
```

Note that the caller has to add the same `If-Unmodified-Since` header to use the URL. The caller cannot omit the header or use a different header, since the signature covers the headers. If the caller uses a different header, the presigned URL signature would not match, and they would receive a `403/SignatureDoesNotMatch`.

</TabItem>
</Tabs>

## Differences between presigned URLs and public buckets

Presigned URLs share some superficial similarity with public buckets. If you give out presigned URLs only for `GET`/`HEAD` operations on specific objects in a bucket, then your presigned URL functionality is mostly similar to public buckets. The notable exception is that any custom metadata associated with the object is rendered in headers with the `x-amz-meta-` prefix. Any error responses are returned as XML documents, as they would with normal non-presigned S3 access.

Presigned URLs can be generated for any S3 operation. After a presigned URL is generated it can be reused as many times as the holder of the URL wants until the signed expiry date.

[Public buckets](/r2/buckets/public-buckets/) are available on a regular HTTP endpoint. By default, there is no authorization or access controls associated with a public bucket. Anyone with a public bucket URL can access an object in that public bucket. If you are using a custom domain to expose the R2 bucket, you can manage authorization and access controls as you would for a Cloudflare zone. Public buckets only provide `GET`/`HEAD` on a known object path. Public bucket errors are rendered as HTML pages.

Choosing between presigned URLs and public buckets is dependent on your specific use case. You can also use both if your architecture should use public buckets in one situation and presigned URLs in another. It is useful to note that presigned URLs will expose your account ID and bucket name to whoever gets a copy of the URL. Public bucket URLs do not contain the account ID or bucket name. Typically, you will not share presigned URLs directly with end users or browsers, as presigned URLs are used more for internal applications.

## Limitations

Presigned URLs can only be used with the `<accountid>.r2.cloudflarestorage.com` S3 API domain and cannot be used with custom domains. Instead, you can use the [general purpose HMAC validation feature of the WAF](/ruleset-engine/rules-language/functions/#hmac-validation), which requires a Pro plan or above.

## Related resources

- [Create a public bucket](/r2/buckets/public-buckets/)
- [Storing user generated content](/reference-architecture/diagrams/storage/storing-user-generated-content/)

---

# Workers API

URL: https://developers.cloudflare.com/r2/api/workers/

import { DirectoryListing } from "~/components";

<DirectoryListing />

---

# Workers API reference

URL: https://developers.cloudflare.com/r2/api/workers/workers-api-reference/

import { Type, MetaInfo, WranglerConfig } from "~/components";

The in-Worker R2 API is accessed by binding an R2 bucket to a [Worker](/workers). The Worker you write can expose external access to buckets via a route or manipulate R2 objects internally.

The R2 API includes some extensions and semantic differences from the S3 API. If you need S3 compatibility, consider using the [S3-compatible API](/r2/api/s3/).

## Concepts

R2 organizes the data you store, called objects, into containers, called buckets. Buckets are the fundamental unit of performance, scaling, and access within R2.

## Create a binding

:::note[Bindings]

A binding is how your Worker interacts with external resources such as [KV Namespaces](/kv/concepts/kv-namespaces/), [Durable Objects](/durable-objects/), or [R2 Buckets](/r2/buckets/). A binding is a runtime variable that the Workers runtime provides to your code. You can declare a variable name in your Wrangler file that will be bound to these resources at runtime, and interact with them through this variable. Every binding's variable name and behavior is determined by you when deploying the Worker. Refer to [Environment Variables](/workers/configuration/environment-variables/) for more information.

A binding is defined in the Wrangler file of your Worker project's directory.

:::

To bind your R2 bucket to your Worker, add the following to your Wrangler file. Update the `binding` property to a valid JavaScript variable identifier and `bucket_name` to the name of your R2 bucket:

<WranglerConfig>

```toml
[[r2_buckets]]
binding = 'MY_BUCKET' # <~ valid JavaScript variable name
bucket_name = '<YOUR_BUCKET_NAME>'
```

</WranglerConfig>

Within your Worker, your bucket binding is now available under the `MY_BUCKET` variable and you can begin interacting with it using the [bucket methods](#bucket-method-definitions) described below.

## Bucket method definitions

The following methods are available on the bucket binding object injected into your code.

For example, to issue a `PUT` object request using the binding above:

```js
export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const key = url.pathname.slice(1);

		switch (request.method) {
			case "PUT":
				await env.MY_BUCKET.put(key, request.body);
				return new Response(`Put ${key} successfully!`);

			default:
				return new Response(`${request.method} is not allowed.`, {
					status: 405,
					headers: {
						Allow: "PUT",
					},
				});
		}
	},
};
```

- `head` <Type text="(key: string): Promise<R2Object | null>" />

  - Retrieves the `R2Object` for the given key containing only object metadata, if the key exists, and `null` if the key does not exist.

- `get` <Type text="(key: string, options?: R2GetOptions): Promise<R2ObjectBody | R2Object | null>" />

  - Retrieves the `R2ObjectBody` for the given key containing object metadata and the object body as a <code>ReadableStream</code>, if the key exists, and `null` if the key does not exist.
  - In the event that a precondition specified in <code>options</code> fails, <code>get()</code> returns an <code>R2Object</code> with <code>body</code> undefined.

- `put` <Type text="(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob, options?: R2PutOptions): Promise<R2Object | null>" />

  - Stores the given <code>value</code> and metadata under the associated <code>key</code>. Once the write succeeds, returns an `R2Object` containing metadata about the stored Object.
  - In the event that a precondition specified in <code>options</code> fails, <code>put()</code> returns `null`, and the object will not be stored.
  - R2 writes are strongly consistent. Once the Promise resolves, all subsequent read operations will see this key value pair globally.

- `delete` <Type text="(key: string | string[]): Promise<void>" />

  - Deletes the given <code>values</code> and metadata under the associated <code>keys</code>. Once the delete succeeds, returns <code>void</code>.
  - R2 deletes are strongly consistent. Once the Promise resolves, all subsequent read operations will no longer see the provided key value pairs globally.
  - Up to 1000 keys may be deleted per call.

- `list` <Type text="(options?: R2ListOptions): Promise<R2Objects>" />

  * Returns an <code>R2Objects</code> containing a list of <code>R2Object</code> contained within the bucket.
  * The returned list of objects is ordered lexicographically.
  * Returns up to 1000 entries, but may return less in order to minimize memory pressure within the Worker.
  * To explicitly set the number of objects to list, provide an [R2ListOptions](/r2/api/workers/workers-api-reference/#r2listoptions) object with the `limit` property set.

* `createMultipartUpload` <Type text="(key: string, options?: R2MultipartOptions): Promise<R2MultipartUpload>" />

  - Creates a multipart upload.
  - Returns Promise which resolves to an `R2MultipartUpload` object representing the newly created multipart upload. Once the multipart upload has been created, the multipart upload can be immediately interacted with globally, either through the Workers API, or through the S3 API.

- `resumeMultipartUpload` <Type text="(key: string, uploadId: string): R2MultipartUpload" />

  - Returns an object representing a multipart upload with the given key and uploadId.
  - The resumeMultipartUpload operation does not perform any checks to ensure the validity of the uploadId, nor does it verify the existence of a corresponding active multipart upload. This is done to minimize latency before being able to call subsequent operations on the `R2MultipartUpload` object.

## `R2Object` definition

`R2Object` is created when you `PUT` an object into an R2 bucket. `R2Object` represents the metadata of an object based on the information provided by the uploader. Every object that you `PUT` into an R2 bucket will have an `R2Object` created.

- `key` <Type text="string" />

  - The object's key.

- `version` <Type text="string" />

  - Random unique string associated with a specific upload of a key.

- `size` <Type text="number" />

  - Size of the object in bytes.

- `etag` <Type text="string" />

:::note

Cloudflare recommends using the `httpEtag` field when returning an etag in a response header. This ensures the etag is quoted and conforms to [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110#section-8.8.3).
:::

- The etag associated with the object upload.

- `httpEtag` <Type text="string" />

  - The object's etag, in quotes so as to be returned as a header.

- `uploaded` <Type text="Date" />

  - A Date object representing the time the object was uploaded.

- `httpMetadata` <Type text="R2HTTPMetadata" />

  - Various HTTP headers associated with the object. Refer to [HTTP Metadata](#http-metadata).

- `customMetadata` <Type text="Record<string, string>" />

  - A map of custom, user-defined metadata associated with the object.

- `range` <Type text="R2Range" />

  - A `R2Range` object containing the returned range of the object.

- `checksums` <Type text="R2Checksums" />

  - A `R2Checksums` object containing the stored checksums of the object. Refer to [checksums](#checksums).

- `writeHttpMetadata` <Type text="(headers: Headers): void" />

  - Retrieves the `httpMetadata` from the `R2Object` and applies their corresponding HTTP headers to the `Headers` input object. Refer to [HTTP Metadata](#http-metadata).

- `storageClass` <Type text="'Standard' | 'InfrequentAccess'" />

  - The storage class associated with the object. Refer to [Storage Classes](#storage-class).

- `ssecKeyMd5` <Type text="string" />

  - Hex-encoded MD5 hash of the [SSE-C](/r2/examples/ssec) key used for encryption (if one was provided). Hash can be used to identify which key is needed to decrypt object.

## `R2ObjectBody` definition

`R2ObjectBody` represents an object's metadata combined with its body. It is returned when you `GET` an object from an R2 bucket. The full list of keys for `R2ObjectBody` includes the list below and all keys inherited from [`R2Object`](#r2object-definition).

- `body` <Type text="ReadableStream" />

  - The object's value.

- `bodyUsed` <Type text="boolean" />

  - Whether the object's value has been consumed or not.

- `arrayBuffer` <Type text="(): Promise<ArrayBuffer>" />

  - Returns a Promise that resolves to an `ArrayBuffer` containing the object's value.

- `text` <Type text="(): Promise<string>" />

  - Returns a Promise that resolves to an string containing the object's value.

- `json` <Type text="<T>() : Promise<T>" />

  - Returns a Promise that resolves to the given object containing the object's value.

- `blob` <Type text="(): Promise<Blob>" />

  - Returns a Promise that resolves to a binary Blob containing the object's value.

## `R2MultipartUpload` definition

An `R2MultipartUpload` object is created when you call `createMultipartUpload` or `resumeMultipartUpload`. `R2MultipartUpload` is a representation of an ongoing multipart upload.

Uncompleted multipart uploads will be automatically aborted after 7 days.

:::note

An `R2MultipartUpload` object does not guarantee that there is an active underlying multipart upload corresponding to that object.

A multipart upload can be completed or aborted at any time, either through the S3 API, or by a parallel invocation of your Worker. Therefore it is important to add the necessary error handling code around each operation on a `R2MultipartUpload` object in case the underlying multipart upload no longer exists.

:::

- `key` <Type text="string" />

  - The `key` for the multipart upload.

- `uploadId` <Type text="string" />

  - The `uploadId` for the multipart upload.

- `uploadPart` <Type text="(partNumber: number, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob, options?: R2MultipartOptions): Promise<R2UploadedPart>" />

  - Uploads a single part with the specified part number to this multipart upload. Each part must be uniform in size with an exception for the final part which can be smaller.
  - Returns an `R2UploadedPart` object containing the `etag` and `partNumber`. These `R2UploadedPart` objects are required when completing the multipart upload.

- `abort` <Type text="(): Promise<void>" />

  - Aborts the multipart upload. Returns a Promise that resolves when the upload has been successfully aborted.

- `complete` <Type text="(uploadedParts: R2UploadedPart[]): Promise<R2Object>" />

  - Completes the multipart upload with the given parts.
  - Returns a Promise that resolves when the complete operation has finished. Once this happens, the object is immediately accessible globally by any subsequent read operation.

## Method-specific types

### R2GetOptions

- `onlyIf` <Type text="R2Conditional | Headers" />

  - Specifies that the object should only be returned given satisfaction of certain conditions in the `R2Conditional` or in the conditional Headers. Refer to [Conditional operations](#conditional-operations).

- `range` <Type text="R2Range" />

  - Specifies that only a specific length (from an optional offset) or suffix of bytes from the object should be returned. Refer to [Ranged reads](#ranged-reads).

- `ssecKey` <Type text="ArrayBuffer | string" />

  - Specifies a key to be used for [SSE-C](/r2/examples/ssec). Key must be 32 bytes in length, in the form of a hex-encoded string or an ArrayBuffer.

#### Ranged reads

`R2GetOptions` accepts a `range` parameter, which can be used to restrict the data returned in `body`.

There are 3 variations of arguments that can be used in a range:

- An offset with an optional length.
- An optional offset with a length.
- A suffix.

- `offset` <Type text="number" />

  - The byte to begin returning data from, inclusive.

- `length` <Type text="number" />

  - The number of bytes to return. If more bytes are requested than exist in the object, fewer bytes than this number may be returned.

- `suffix` <Type text="number" />

  - The number of bytes to return from the end of the file, starting from the last byte. If more bytes are requested than exist in the object, fewer bytes than this number may be returned.

### R2PutOptions

- `onlyIf` <Type text="R2Conditional | Headers" />

  - Specifies that the object should only be stored given satisfaction of certain conditions in the `R2Conditional`. Refer to [Conditional operations](#conditional-operations).

- `httpMetadata` <Type text="R2HTTPMetadata | Headers" /> <MetaInfo text="optional" />

  - Various HTTP headers associated with the object. Refer to [HTTP Metadata](#http-metadata).

- `customMetadata` <Type text="Record<string, string>" /> <MetaInfo text="optional" />

  - A map of custom, user-defined metadata that will be stored with the object.

:::note

Only a single hashing algorithm can be specified at once.

:::

- `md5` <Type text="ArrayBuffer | string" /> <MetaInfo text="optional" />

  - A md5 hash to use to check the received object's integrity.

- `sha1` <Type text="ArrayBuffer | string" /> <MetaInfo text="optional" />

  - A SHA-1 hash to use to check the received object's integrity.

- `sha256` <Type text="ArrayBuffer | string" /> <MetaInfo text="optional" />

  - A SHA-256 hash to use to check the received object's integrity.

- `sha384` <Type text="ArrayBuffer | string" /> <MetaInfo text="optional" />

  - A SHA-384 hash to use to check the received object's integrity.

- `sha512` <Type text="ArrayBuffer | string" /> <MetaInfo text="optional" />

  - A SHA-512 hash to use to check the received object's integrity.

- `storageClass` <Type text="'Standard' | 'InfrequentAccess'" />

  - Sets the storage class of the object if provided. Otherwise, the object will be stored in the default storage class associated with the bucket. Refer to [Storage Classes](#storage-class).

- `ssecKey` <Type text="ArrayBuffer | string" />

  - Specifies a key to be used for [SSE-C](/r2/examples/ssec). Key must be 32 bytes in length, in the form of a hex-encoded string or an ArrayBuffer.

### R2MultipartOptions

- `httpMetadata` <Type text="R2HTTPMetadata | Headers" /> <MetaInfo text="optional" />

  - Various HTTP headers associated with the object. Refer to [HTTP Metadata](#http-metadata).

- `customMetadata` <Type text="Record<string, string>" /> <MetaInfo text="optional" />

  - A map of custom, user-defined metadata that will be stored with the object.

- `storageClass` <Type text="string" />

  - Sets the storage class of the object if provided. Otherwise, the object will be stored in the default storage class associated with the bucket. Refer to [Storage Classes](#storage-class).

- `ssecKey` <Type text="ArrayBuffer | string" />

  - Specifies a key to be used for [SSE-C](/r2/examples/ssec). Key must be 32 bytes in length, in the form of a hex-encoded string or an ArrayBuffer.

### R2ListOptions

- `limit` <Type text="number" /> <MetaInfo text="optional" />

  - The number of results to return. Defaults to `1000`, with a maximum of `1000`.

  - If `include` is set, you may receive fewer than `limit` results in your response to accommodate metadata.

- `prefix` <Type text="string" /> <MetaInfo text="optional" />

  - The prefix to match keys against. Keys will only be returned if they start with given prefix.

- `cursor` <Type text="string" /> <MetaInfo text="optional" />

  - An opaque token that indicates where to continue listing objects from. A cursor can be retrieved from a previous list operation.

- `delimiter` <Type text="string" /> <MetaInfo text="optional" />

  - The character to use when grouping keys.

- `include` <Type text="Array<string>" /> <MetaInfo text="optional" />

  - Can include `httpMetadata` and/or `customMetadata`. If included, items returned by the list will include the specified metadata.

  - Note that there is a limit on the total amount of data that a single `list` operation can return. If you request data, you may receive fewer than `limit` results in your response to accommodate metadata.

  - The [compatibility date](/workers/configuration/compatibility-dates/) must be set to `2022-08-04` or later in your Wrangler file. If not, then the `r2_list_honor_include` compatibility flag must be set. Otherwise it is treated as `include: ['httpMetadata', 'customMetadata']` regardless of what the `include` option provided actually is.

  This means applications must be careful to avoid comparing the amount of returned objects against your `limit`. Instead, use the `truncated` property to determine if the `list` request has more data to be returned.

```js
const options = {
	limit: 500,
	include: ["customMetadata"],
};

const listed = await env.MY_BUCKET.list(options);

let truncated = listed.truncated;
let cursor = truncated ? listed.cursor : undefined;

// ❌ - if your limit can't fit into a single response or your
// bucket has less objects than the limit, it will get stuck here.
while (listed.objects.length < options.limit) {
	// ...
}

// ✅ - use the truncated property to check if there are more
// objects to be returned
while (truncated) {
	const next = await env.MY_BUCKET.list({
		...options,
		cursor: cursor,
	});
	listed.objects.push(...next.objects);

	truncated = next.truncated;
	cursor = next.cursor;
}
```

### R2Objects

An object containing an `R2Object` array, returned by `BUCKET_BINDING.list()`.

- `objects` <Type text="Array<R2Object>" />

  - An array of objects matching the `list` request.

- `truncated` boolean

  - If true, indicates there are more results to be retrieved for the current `list` request.

- `cursor` <Type text="string" /> <MetaInfo text="optional" />

  - A token that can be passed to future `list` calls to resume listing from that point. Only present if truncated is true.

- `delimitedPrefixes` <Type text="Array<string>" />

  - If a delimiter has been specified, contains all prefixes between the specified prefix and the next occurrence of the delimiter.

  - For example, if no prefix is provided and the delimiter is '/', `foo/bar/baz` would return `foo` as a delimited prefix. If `foo/` was passed as a prefix with the same structure and delimiter, `foo/bar` would be returned as a delimited prefix.

### Conditional operations

You can pass an `R2Conditional` object to `R2GetOptions` and `R2PutOptions`. If the condition check for `get()` fails, the body will not be returned. This will make `get()` have lower latency.

If the condition check for `put()` fails, `null` will be returned instead of the `R2Object`.

- `etagMatches` <Type text="string" /> <MetaInfo text="optional" />

  - Performs the operation if the object's etag matches the given string.

- `etagDoesNotMatch` <Type text="string" /> <MetaInfo text="optional" />

  - Performs the operation if the object's etag does not match the given string.

- `uploadedBefore` <Type text="Date" /> <MetaInfo text="optional" />

  - Performs the operation if the object was uploaded before the given date.

- `uploadedAfter` <Type text="Date" /> <MetaInfo text="optional" />

  - Performs the operation if the object was uploaded after the given date.

Alternatively, you can pass a `Headers` object containing conditional headers to `R2GetOptions` and `R2PutOptions`. For information on these conditional headers, refer to [the MDN docs on conditional requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Conditional_requests#conditional_headers). All conditional headers aside from `If-Range` are supported.

For more specific information about conditional requests, refer to [RFC 7232](https://datatracker.ietf.org/doc/html/rfc7232).

### HTTP Metadata

Generally, these fields match the HTTP metadata passed when the object was created. They can be overridden when issuing `GET` requests, in which case, the given values will be echoed back in the response.

- `contentType` <Type text="string" /> <MetaInfo text="optional" />

- `contentLanguage` <Type text="string" /> <MetaInfo text="optional" />

- `contentDisposition` <Type text="string" /> <MetaInfo text="optional" />

- `contentEncoding` <Type text="string" /> <MetaInfo text="optional" />

- `cacheControl` <Type text="string" /> <MetaInfo text="optional" />

- `cacheExpiry` <Type text="Date" /> <MetaInfo text="optional" />

### Checksums

If a checksum was provided when using the `put()` binding, it will be available on the returned object under the `checksums` property. The MD5 checksum will be included by default for non-multipart objects.

- `md5` <Type text="ArrayBuffer" /> <MetaInfo text="optional" />

  - The MD5 checksum of the object.

- `sha1` <Type text="ArrayBuffer" /> <MetaInfo text="optional" />

  - The SHA-1 checksum of the object.

- `sha256` <Type text="ArrayBuffer" /> <MetaInfo text="optional" />

  - The SHA-256 checksum of the object.

- `sha384` <Type text="ArrayBuffer" /> <MetaInfo text="optional" />

  - The SHA-384 checksum of the object.

- `sha512` <Type text="ArrayBuffer" /> <MetaInfo text="optional" />

  - The SHA-512 checksum of the object.

### `R2UploadedPart`

An `R2UploadedPart` object represents a part that has been uploaded. `R2UploadedPart` objects are returned from `uploadPart` operations and must be passed to `completeMultipartUpload` operations.

- `partNumber` <Type text="number" />

  - The number of the part.

- `etag` <Type text="string" />

  - The `etag` of the part.

### Storage Class

The storage class where an `R2Object` is stored. The available storage classes are `Standard` and `InfrequentAccess`. Refer to [Storage classes](/r2/buckets/storage-classes/)
for more information.

---

# Use R2 from Workers

URL: https://developers.cloudflare.com/r2/api/workers/workers-api-usage/

import { Render, PackageManagers, WranglerConfig } from "~/components";

## 1. Create a new application with C3

C3 (`create-cloudflare-cli`) is a command-line tool designed to help you set up and deploy Workers & Pages applications to Cloudflare as fast as possible.

To get started, open a terminal window and run:

<PackageManagers type="create" pkg="cloudflare@latest" args={"r2-worker"} />

<Render
	file="c3-post-run-steps"
	product="workers"
	params={{
		category: "hello-world",
		type: "Worker only",
		lang: "JavaScript",
	}}
/>

Then, move into your newly created directory:

```sh
cd r2-worker
```

## 2. Create your bucket

Create your bucket by running:

```sh
npx wrangler r2 bucket create <YOUR_BUCKET_NAME>
```

To check that your bucket was created, run:

```sh
npx wrangler r2 bucket list
```

After running the `list` command, you will see all bucket names, including the one you have just created.

## 3. Bind your bucket to a Worker

You will need to bind your bucket to a Worker.

:::note[Bindings]

A binding is how your Worker interacts with external resources such as [KV Namespaces](/kv/concepts/kv-namespaces/), [Durable Objects](/durable-objects/), or [R2 Buckets](/r2/buckets/). A binding is a runtime variable that the Workers runtime provides to your code. You can declare a variable name in your Wrangler file that will be bound to these resources at runtime, and interact with them through this variable. Every binding's variable name and behavior is determined by you when deploying the Worker. Refer to the [Environment Variables](/workers/configuration/environment-variables/) documentation for more information.

A binding is defined in the Wrangler file of your Worker project's directory.

:::

To bind your R2 bucket to your Worker, add the following to your Wrangler file. Update the `binding` property to a valid JavaScript variable identifier and `bucket_name` to the `<YOUR_BUCKET_NAME>` you used to create your bucket in [step 2](#2-create-your-bucket):

<WranglerConfig>

```toml
[[r2_buckets]]
binding = 'MY_BUCKET' # <~ valid JavaScript variable name
bucket_name = '<YOUR_BUCKET_NAME>'
```

</WranglerConfig>

Find more detailed information on configuring your Worker in the [Wrangler Configuration documentation](/workers/wrangler/configuration/).

## 4. Access your R2 bucket from your Worker

Within your Worker code, your bucket is now available under the `MY_BUCKET` variable and you can begin interacting with it.

:::caution[Local Development mode in Wrangler]

By default `wrangler dev` runs in local development mode. In this mode, all operations performed by your local worker will operate against local storage on your machine.
Use `wrangler dev --remote` if you want R2 operations made during development to be performed against a real R2 bucket.

:::

An R2 bucket is able to READ, LIST, WRITE, and DELETE objects. You can see an example of all operations below using the Module Worker syntax. Add the following snippet into your project's `index.js` file:

```js
export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const key = url.pathname.slice(1);

		switch (request.method) {
			case "PUT":
				await env.MY_BUCKET.put(key, request.body);
				return new Response(`Put ${key} successfully!`);
			case "GET":
				const object = await env.MY_BUCKET.get(key);

				if (object === null) {
					return new Response("Object Not Found", { status: 404 });
				}

				const headers = new Headers();
				object.writeHttpMetadata(headers);
				headers.set("etag", object.httpEtag);

				return new Response(object.body, {
					headers,
				});
			case "DELETE":
				await env.MY_BUCKET.delete(key);
				return new Response("Deleted!");

			default:
				return new Response("Method Not Allowed", {
					status: 405,
					headers: {
						Allow: "PUT, GET, DELETE",
					},
				});
		}
	},
};
```

<Render file="request-dot-clone-warning" product="workers" />

## 5. Bucket access and privacy

With the above code added to your Worker, every incoming request has the ability to interact with your bucket. This means your bucket is publicly exposed and its contents can be accessed and modified by undesired actors.

You must now define authorization logic to determine who can perform what actions to your bucket. This logic lives within your Worker's code, as it is your application's job to determine user privileges. The following is a short list of resources related to access and authorization practices:

1. [Basic Authentication](/workers/examples/basic-auth/): Shows how to restrict access using the HTTP Basic schema.
2. [Using Custom Headers](/workers/examples/auth-with-headers/): Allow or deny a request based on a known pre-shared key in a header.

{/* <!-- 3. [Authorizing users with Auth0](/workers/tutorials/authorize-users-with-auth0/#overview): Integrate Auth0, an identity management platform, into a Cloudflare Workers application. --> */}

Continuing with your newly created bucket and Worker, you will need to protect all bucket operations.

For `PUT` and `DELETE` requests, you will make use of a new `AUTH_KEY_SECRET` environment variable, which you will define later as a Wrangler secret.

For `GET` requests, you will ensure that only a specific file can be requested. All of this custom logic occurs inside of an `authorizeRequest` function, with the `hasValidHeader` function handling the custom header logic. If all validation passes, then the operation is allowed.

```js
const ALLOW_LIST = ["cat-pic.jpg"];

// Check requests for a pre-shared secret
const hasValidHeader = (request, env) => {
	return request.headers.get("X-Custom-Auth-Key") === env.AUTH_KEY_SECRET;
};

function authorizeRequest(request, env, key) {
	switch (request.method) {
		case "PUT":
		case "DELETE":
			return hasValidHeader(request, env);
		case "GET":
			return ALLOW_LIST.includes(key);
		default:
			return false;
	}
}

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const key = url.pathname.slice(1);

		if (!authorizeRequest(request, env, key)) {
			return new Response("Forbidden", { status: 403 });
		}

		// ...
	},
};
```

For this to work, you need to create a secret via Wrangler:

```sh
npx wrangler secret put AUTH_KEY_SECRET
```

This command will prompt you to enter a secret in your terminal:

```sh
npx wrangler secret put AUTH_KEY_SECRET
```

```sh output
Enter the secret text you'd like assigned to the variable AUTH_KEY_SECRET on the script named <YOUR_WORKER_NAME>:
*********
🌀  Creating the secret for script name <YOUR_WORKER_NAME>
✨  Success! Uploaded secret AUTH_KEY_SECRET.
```

This secret is now available as `AUTH_KEY_SECRET` on the `env` parameter in your Worker.

## 6. Deploy your bucket

With your Worker and bucket set up, run the `npx wrangler deploy` [command](/workers/wrangler/commands/#deploy) to deploy to Cloudflare's global network:

```sh
npx wrangler deploy
```

You can verify your authorization logic is working through the following commands, using your deployed Worker endpoint:

:::caution

When uploading files to R2 via `curl`, ensure you use **[`--data-binary`](https://everything.curl.dev/http/post/binary)** instead of `--data` or `-d`. Files will otherwise be truncated.
:::

```sh
# Attempt to write an object without providing the "X-Custom-Auth-Key" header
curl https://your-worker.dev/cat-pic.jpg -X PUT --data-binary 'test'
#=> Forbidden
# Expected because header was missing

# Attempt to write an object with the wrong "X-Custom-Auth-Key" header value
curl https://your-worker.dev/cat-pic.jpg -X PUT --header "X-Custom-Auth-Key: hotdog" --data-binary 'test'
#=> Forbidden
# Expected because header value did not match the AUTH_KEY_SECRET value

# Attempt to write an object with the correct "X-Custom-Auth-Key" header value
# Note: Assume that "*********" is the value of your AUTH_KEY_SECRET Wrangler secret
curl https://your-worker.dev/cat-pic.jpg -X PUT --header "X-Custom-Auth-Key: *********" --data-binary 'test'
#=> Put cat-pic.jpg successfully!

# Attempt to read object called "foo"
curl https://your-worker.dev/foo
#=> Forbidden
# Expected because "foo" is not in the ALLOW_LIST

# Attempt to read an object called "cat-pic.jpg"
curl https://your-worker.dev/cat-pic.jpg
#=> test
# Note: This is the value that was successfully PUT above
```

By completing this guide, you have successfully installed Wrangler and deployed your R2 bucket to Cloudflare.

## Related resources

1. [Workers Tutorials](/workers/tutorials/)
2. [Workers Examples](/workers/examples/)

---

# Use the R2 multipart API from Workers

URL: https://developers.cloudflare.com/r2/api/workers/workers-multipart-usage/

By following this guide, you will create a Worker through which your applications can perform multipart uploads.
This example worker could serve as a basis for your own use case where you can add authentication to the worker, or even add extra validation logic when uploading each part.
This guide also contains an example Python application that uploads files to this worker.

This guide assumes you have set up the [R2 binding](/workers/runtime-apis/bindings/) for your Worker. Refer to [Use R2 from Workers](/r2/api/workers/workers-api-usage) for instructions on setting up an R2 binding.

## An example Worker using the multipart API

The following example Worker exposes an HTTP API which enables applications to use the multipart API through the Worker.

In this example, each request is routed based on the HTTP method and the action request parameter. As your Worker becomes more complicated, consider utilizing a serverless web framework such as [Hono](https://honojs.dev/) to handle the routing for you.

The following example Worker includes any new information about the state of the multipart upload in the response to each request. For the request which creates the multipart upload, the `uploadId` is returned. For requests uploading a part, the part number and `etag` are returned. In turn, the client keeps track of this state, and includes the uploadId in subsequent requests, and the `etag` and part number of each part when completing a multipart upload.

Add the following code to your project's `index.js` file and replace `MY_BUCKET` with your bucket's name:

```js
interface Env {
  MY_BUCKET: R2Bucket;
}

export default {
  async fetch(
    request,
    env,
    ctx
  ): Promise<Response> {
    const bucket = env.MY_BUCKET;

    const url = new URL(request.url);
    const key = url.pathname.slice(1);
    const action = url.searchParams.get("action");

    if (action === null) {
      return new Response("Missing action type", { status: 400 });
    }

    // Route the request based on the HTTP method and action type
    switch (request.method) {
      case "POST":
        switch (action) {
          case "mpu-create": {
            const multipartUpload = await bucket.createMultipartUpload(key);
            return new Response(
              JSON.stringify({
                key: multipartUpload.key,
                uploadId: multipartUpload.uploadId,
              })
            );
          }
          case "mpu-complete": {
            const uploadId = url.searchParams.get("uploadId");
            if (uploadId === null) {
              return new Response("Missing uploadId", { status: 400 });
            }

            const multipartUpload = env.MY_BUCKET.resumeMultipartUpload(
              key,
              uploadId
            );

            interface completeBody {
              parts: R2UploadedPart[];
            }
            const completeBody: completeBody = await request.json();
            if (completeBody === null) {
              return new Response("Missing or incomplete body", {
                status: 400,
              });
            }

            // Error handling in case the multipart upload does not exist anymore
            try {
              const object = await multipartUpload.complete(completeBody.parts);
              return new Response(null, {
                headers: {
                  etag: object.httpEtag,
                },
              });
            } catch (error: any) {
              return new Response(error.message, { status: 400 });
            }
          }
          default:
            return new Response(`Unknown action ${action} for POST`, {
              status: 400,
            });
        }
      case "PUT":
        switch (action) {
          case "mpu-uploadpart": {
            const uploadId = url.searchParams.get("uploadId");
            const partNumberString = url.searchParams.get("partNumber");
            if (partNumberString === null || uploadId === null) {
              return new Response("Missing partNumber or uploadId", {
                status: 400,
              });
            }
            if (request.body === null) {
              return new Response("Missing request body", { status: 400 });
            }

            const partNumber = parseInt(partNumberString);
            const multipartUpload = env.MY_BUCKET.resumeMultipartUpload(
              key,
              uploadId
            );
            try {
              const uploadedPart: R2UploadedPart =
                await multipartUpload.uploadPart(partNumber, request.body);
              return new Response(JSON.stringify(uploadedPart));
            } catch (error: any) {
              return new Response(error.message, { status: 400 });
            }
          }
          default:
            return new Response(`Unknown action ${action} for PUT`, {
              status: 400,
            });
        }
      case "GET":
        if (action !== "get") {
          return new Response(`Unknown action ${action} for GET`, {
            status: 400,
          });
        }
        const object = await env.MY_BUCKET.get(key);
        if (object === null) {
          return new Response("Object Not Found", { status: 404 });
        }
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);
        return new Response(object.body, { headers });
      case "DELETE":
        switch (action) {
          case "mpu-abort": {
            const uploadId = url.searchParams.get("uploadId");
            if (uploadId === null) {
              return new Response("Missing uploadId", { status: 400 });
            }
            const multipartUpload = env.MY_BUCKET.resumeMultipartUpload(
              key,
              uploadId
            );

            try {
              multipartUpload.abort();
            } catch (error: any) {
              return new Response(error.message, { status: 400 });
            }
            return new Response(null, { status: 204 });
          }
          case "delete": {
            await env.MY_BUCKET.delete(key);
            return new Response(null, { status: 204 });
          }
          default:
            return new Response(`Unknown action ${action} for DELETE`, {
              status: 400,
            });
        }
      default:
        return new Response("Method Not Allowed", {
          status: 405,
          headers: { Allow: "PUT, POST, GET, DELETE" },
        });
    }
  },
} satisfies ExportedHandler<Env>;
```

After you have updated your Worker with the above code, run `npx wrangler deploy`.

You can now use this Worker to perform multipart uploads. You can either send requests from your existing application to this Worker to perform uploads or use a script to upload files through this Worker.

The next section is optional and shows an example of a Python script which uploads a chosen file on your machine to your Worker.

## Perform a multipart upload with your Worker (optional)

This example application uploads a local file to the Worker in multiple parts. It uses Python's built-in `ThreadPoolExecutor` to parallelize the uploading of parts to the Worker, which increases upload speeds. HTTP requests to the Worker are made with the [requests](https://pypi.org/project/requests/) library.

Utilizing the multipart API in this way also allows you to use your Worker to upload files larger than the [Workers request body size limit](/workers/platform/limits#request-limits). The uploading of individual parts is still subject to this limit.

Save the following code in a file named `mpuscript.py` on your local machine. Change the `worker_endpoint variable` to where your worker is deployed. Pass the file you want to upload as an argument when running this script: `python3 mpuscript.py myfile`. This will upload the file `myfile` from your machine to your bucket through the Worker.

```python
import math
import os
import requests
from requests.adapters import HTTPAdapter, Retry
import sys
import concurrent.futures

# Take the file to upload as an argument
filename = sys.argv[1]
# The endpoint for our worker, change this to wherever you deploy your worker
worker_endpoint = "https://myworker.myzone.workers.dev/"
# Configure the part size to be 10MB. 5MB is the minimum part size, except for the last part
partsize = 10 * 1024 * 1024


def upload_file(worker_endpoint, filename, partsize):
    url = f"{worker_endpoint}{filename}"

    # Create the multipart upload
    uploadId = requests.post(url, params={"action": "mpu-create"}).json()["uploadId"]

    part_count = math.ceil(os.stat(filename).st_size / partsize)
    # Create an executor for up to 25 concurrent uploads.
    executor = concurrent.futures.ThreadPoolExecutor(25)
    # Submit a task to the executor to upload each part
    futures = [
        executor.submit(upload_part, filename, partsize, url, uploadId, index)
        for index in range(part_count)
    ]
    concurrent.futures.wait(futures)
    # get the parts from the futures
    uploaded_parts = [future.result() for future in futures]

    # complete the multipart upload
    response = requests.post(
        url,
        params={"action": "mpu-complete", "uploadId": uploadId},
        json={"parts": uploaded_parts},
    )
    if response.status_code == 200:
        print("🎉 successfully completed multipart upload")
    else:
        print(response.text)


def upload_part(filename, partsize, url, uploadId, index):
    # Open the file in rb mode, which treats it as raw bytes rather than attempting to parse utf-8
    with open(filename, "rb") as file:
        file.seek(partsize * index)
        part = file.read(partsize)

    # Retry policy for when uploading a part fails
    s = requests.Session()
    retries = Retry(total=3, status_forcelist=[400, 500, 502, 503, 504])
    s.mount("https://", HTTPAdapter(max_retries=retries))

    return s.put(
        url,
        params={
            "action": "mpu-uploadpart",
            "uploadId": uploadId,
            "partNumber": str(index + 1),
        },
        data=part,
    ).json()


upload_file(worker_endpoint, filename, partsize)
```

## State management

The stateful nature of multipart uploads does not easily map to the usage model of Workers, which are inherently stateless. In a normal multipart upload, the multipart upload is usually performed in one continuous execution of the client application. This is different from multipart uploads in a Worker, which will often be completed over multiple invocations of that Worker. This makes state management more challenging.

To overcome this, the state associated with a multipart upload, namely the `uploadId` and which parts have been uploaded, needs to be kept track of somewhere outside of the Worker.

In the example Worker and Python application described in this guide, the state of the multipart upload is tracked in the client application which sends requests to the Worker, with the necessary state contained in each request. Keeping track of the multipart state in the client application enables maximal flexibility and allows for parallel and unordered uploads of each part.

When keeping track of this state in the client is impossible, alternative designs can be considered. For example, you could track the `uploadId` and which parts have been uploaded in a Durable Object or other database.

---

# DuckDB

URL: https://developers.cloudflare.com/r2/data-catalog/config-examples/duckdb/

Below is an example of using [DuckDB](https://duckdb.org/) to connect to R2 Data Catalog (read-only). For more information on connecting to R2 Data Catalog with DuckDB, refer to [DuckDB documentation](https://duckdb.org/docs/stable/core_extensions/iceberg/iceberg_rest_catalogs#r2-catalog).

## Prerequisites

- Sign up for a [Cloudflare account](https://dash.cloudflare.com/sign-up/workers-and-pages).
- [Create an R2 bucket](/r2/buckets/create-buckets/) and [enable the data catalog](/r2/data-catalog/manage-catalogs/#enable-r2-data-catalog-on-a-bucket).
- [Create an R2 API token](/r2/api/tokens/) with both [R2 and data catalog permissions](/r2/api/tokens/#permissions).
- Install [DuckDB](https://duckdb.org/docs/installation/).
  - Note: [DuckDB 1.3.0](https://github.com/duckdb/duckdb/releases/tag/v1.3.0) or greater is required to attach [Iceberg REST Catalogs](https://duckdb.org/docs/stable/core_extensions/iceberg/iceberg_rest_catalogs).

## Example usage

In the [DuckDB CLI](https://duckdb.org/docs/stable/clients/cli/overview.html) (Command Line Interface), run the following commands:

```sql
-- Install the iceberg DuckDB extension (if you haven't already) and load the extension.
INSTALL iceberg;
LOAD iceberg;

-- Create a DuckDB secret to store R2 Data Catalog credentials.
CREATE SECRET r2_secret (
    TYPE ICEBERG,
    TOKEN '<token>'
);

-- Attach R2 Data Catalog with the following ATTACH statement (read-only).
ATTACH '<warehouse_name>' AS my_r2_catalog (
    TYPE ICEBERG,
    ENDPOINT '<catalog_uri>'
);

-- Show all available tables.
SHOW ALL TABLES;

-- Query your Iceberg table.
SELECT * FROM my_r2_catalog.default.my_iceberg_table;
```

---

# Connect to Iceberg engines

URL: https://developers.cloudflare.com/r2/data-catalog/config-examples/

import { DirectoryListing } from "~/components";

Below are configuration examples to connect various Iceberg engines to [R2 Data Catalog](/r2/data-catalog/):

<DirectoryListing />

---

# PyIceberg

URL: https://developers.cloudflare.com/r2/data-catalog/config-examples/pyiceberg/

Below is an example of using [PyIceberg](https://py.iceberg.apache.org/) to connect to R2 Data Catalog.

## Prerequisites

- Sign up for a [Cloudflare account](https://dash.cloudflare.com/sign-up/workers-and-pages).
- [Create an R2 bucket](/r2/buckets/create-buckets/) and [enable the data catalog](/r2/data-catalog/manage-catalogs/#enable-r2-data-catalog-on-a-bucket).
- [Create an R2 API token](/r2/api/tokens/) with both [R2 and data catalog permissions](/r2/api/tokens/#permissions).
- Install the [PyIceberg](https://py.iceberg.apache.org/#installation) and [PyArrow](https://arrow.apache.org/docs/python/install.html) libraries.

## Example usage

```py
import pyarrow as pa
from pyiceberg.catalog.rest import RestCatalog
from pyiceberg.exceptions import NamespaceAlreadyExistsError

# Define catalog connection details (replace variables)
WAREHOUSE = "<WAREHOUSE>"
TOKEN = "<TOKEN>"
CATALOG_URI = "<CATALOG_URI>"

# Connect to R2 Data Catalog
catalog = RestCatalog(
    name="my_catalog",
    warehouse=WAREHOUSE,
    uri=CATALOG_URI,
    token=TOKEN,
)

# Create default namespace
catalog.create_namespace("default")

# Create simple PyArrow table
df = pa.table({
    "id": [1, 2, 3],
    "name": ["Alice", "Bob", "Charlie"],
})

# Create an Iceberg table
test_table = ("default", "my_table")
table = catalog.create_table(
    test_table,
    schema=df.schema,
)
```

---

# Snowflake

URL: https://developers.cloudflare.com/r2/data-catalog/config-examples/snowflake/

Below is an example of using [Snowflake](https://docs.snowflake.com/en/user-guide/tables-iceberg-configure-catalog-integration-rest) to connect and query data from R2 Data Catalog (read-only).

## Prerequisites

- Sign up for a [Cloudflare account](https://dash.cloudflare.com/sign-up/workers-and-pages).
- [Create an R2 bucket](/r2/buckets/create-buckets/) and [enable the data catalog](/r2/data-catalog/manage-catalogs/#enable-r2-data-catalog-on-a-bucket).
- [Create an R2 API token](/r2/api/tokens/) with both [R2 and data catalog permissions](/r2/api/tokens/#permissions).
- A [Snowflake](https://www.snowflake.com/) account with the necessary privileges to create external volumes and catalog integrations.

## Example usage

In your Snowflake [SQL worksheet](https://docs.snowflake.com/en/user-guide/ui-snowsight-worksheets-gs) or [notebook](https://docs.snowflake.com/en/user-guide/ui-snowsight/notebooks), run the following commands:

```sql
-- Create a database (if you don't already have one) to organize your external data
CREATE DATABASE IF NOT EXISTS r2_example_db;

-- Create an external volume pointing to your R2 bucket
CREATE OR REPLACE EXTERNAL VOLUME ext_vol_r2
    STORAGE_LOCATIONS = (
        (
            NAME = 'my_r2_storage_location'
            STORAGE_PROVIDER = 'S3COMPAT'
            STORAGE_BASE_URL = 's3compat://<bucket-name>'
            CREDENTIALS = (
                AWS_KEY_ID = '<access_key>'
                AWS_SECRET_KEY = '<secret_access_key>'
            )
            STORAGE_ENDPOINT = '<account_id>.r2.cloudflarestorage.com'
        )
    )
    ALLOW_WRITES = FALSE;

-- Create a catalog integration for R2 Data Catalog (read-only)
CREATE OR REPLACE CATALOG INTEGRATION r2_data_catalog
    CATALOG_SOURCE = ICEBERG_REST
    TABLE_FORMAT = ICEBERG
    CATALOG_NAMESPACE = 'default'
    REST_CONFIG = (
        CATALOG_URI = '<catalog_uri>'
        CATALOG_NAME = '<warehouse_name>'
    )
    REST_AUTHENTICATION = (
        TYPE = BEARER
        BEARER_TOKEN = '<token>'
    )
    ENABLED = TRUE;

-- Create an Apache Iceberg table in your selected Snowflake database
CREATE ICEBERG TABLE my_iceberg_table
    CATALOG = 'r2_data_catalog'
    EXTERNAL_VOLUME = 'ext_vol_r2'
    CATALOG_TABLE_NAME = 'my_table';  -- Name of existing table in your R2 data catalog

-- Query your Iceberg table
SELECT * FROM my_iceberg_table;
```

---

# Spark (Scala)

URL: https://developers.cloudflare.com/r2/data-catalog/config-examples/spark-scala/

import { FileTree } from "~/components"


Below is an example of how you can build an [Apache Spark](https://spark.apache.org/) application (with Scala) which connects to R2 Data Catalog. This application is built to run locally, but it can be adapted to run on a cluster.

## Prerequisites

- Sign up for a [Cloudflare account](https://dash.cloudflare.com/sign-up/workers-and-pages).
- [Create an R2 bucket](/r2/buckets/create-buckets/) and [enable the data catalog](/r2/data-catalog/manage-catalogs/#enable-r2-data-catalog-on-a-bucket).
- [Create an R2 API token](/r2/api/tokens/) with both [R2 and data catalog permissions](/r2/api/tokens/#permissions).
- Install Java 17, Spark 3.5.3, and SBT 1.10.11
  - Note: The specific versions of tools are critical for getting things to work in this example.
  - Tip: [“SDKMAN”](https://sdkman.io/) is a convenient package manager for installing SDKs.

## Example usage

To start, create a new empty project directory somewhere on your machine.

Inside that directory, create the following file at `src/main/scala/com/example/R2DataCatalogDemo.scala`. This will serve as the main entry point for your Spark application.

```java
package com.example

import org.apache.spark.sql.SparkSession

object R2DataCatalogDemo {
    def main(args: Array[String]): Unit = {

        val uri = sys.env("CATALOG_URI")
        val warehouse = sys.env("WAREHOUSE")
        val token = sys.env("TOKEN")

        val spark = SparkSession.builder()
            .appName("My R2 Data Catalog Demo")
            .master("local[*]")
            .config("spark.sql.extensions", "org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions")
            .config("spark.sql.catalog.mydemo", "org.apache.iceberg.spark.SparkCatalog")
            .config("spark.sql.catalog.mydemo.type", "rest")
            .config("spark.sql.catalog.mydemo.uri", uri)
            .config("spark.sql.catalog.mydemo.warehouse", warehouse)
            .config("spark.sql.catalog.mydemo.token", token)
            .getOrCreate()

        import spark.implicits._

        val data = Seq(
            (1, "Alice", 25),
            (2, "Bob", 30),
            (3, "Charlie", 35),
            (4, "Diana", 40)
        ).toDF("id", "name", "age")

        spark.sql("USE mydemo")

        spark.sql("CREATE NAMESPACE IF NOT EXISTS demoNamespace")

        data.writeTo("demoNamespace.demotable").createOrReplace()

        val readResult = spark.sql("SELECT * FROM demoNamespace.demotable WHERE age > 30")
        println("Records with age > 30:")
        readResult.show()
    }
}
```

For building this application and managing dependencies, we will use [sbt (“simple build tool”)](https://www.scala-sbt.org/). The following is an example `build.sbt` file to place at the root of your project. It is configured to produce a "fat JAR", bundling all required dependencies.

```java
name := "R2DataCatalogDemo"

version := "1.0"

val sparkVersion = "3.5.3"
val icebergVersion = "1.8.1"

// You need to use binaries of Spark compiled with either 2.12 or 2.13; and 2.12 is more common.
// If you download Spark 3.5.3 with sdkman, then it comes with 2.12.18
scalaVersion := "2.12.18"

libraryDependencies ++= Seq(
    "org.apache.spark" %% "spark-core" % sparkVersion,
    "org.apache.spark" %% "spark-sql" % sparkVersion,
    "org.apache.iceberg" % "iceberg-core" % icebergVersion,
    "org.apache.iceberg" % "iceberg-spark-runtime-3.5_2.12" % icebergVersion,
    "org.apache.iceberg" % "iceberg-aws-bundle" % icebergVersion,
)

// build a fat JAR with all dependencies
assembly / assemblyMergeStrategy := {
    case PathList("META-INF", "services", xs @ _*) => MergeStrategy.concat
    case PathList("META-INF", xs @ _*) => MergeStrategy.discard
    case "reference.conf" => MergeStrategy.concat
    case "application.conf" => MergeStrategy.concat
    case x if x.endsWith(".properties") => MergeStrategy.first
    case x => MergeStrategy.first
}

// For Java  17 Compatability
Compile / javacOptions ++= Seq("--release", "17")
```

To enable the [sbt-assembly plugin](https://github.com/sbt/sbt-assembly?tab=readme-ov-file) (used to build fat JARs), add the following to a new file at `project/assembly.sbt`:

```
addSbtPlugin("com.eed3si9n" % "sbt-assembly" % "1.2.0")
```

Make sure Java, Spark, and sbt are installed and available in your shell. If you are using SDKMAN, you can install them as shown below:

```bash
sdk install java 17.0.14-amzn
sdk install spark 3.5.3
sdk install sbt 1.10.11
```

With everything installed, you can now build the project using sbt. This will generate a single bundled JAR file.

```bash
sbt clean assembly
```

After building, the output JAR should be located at `target/scala-2.12/R2DataCatalogDemo-assembly-1.0.jar`.

To run the application, you will use `spark-submit`. Below is an example shell script (`submit.sh`) that includes the necessary Java compatability flags for Spark on Java 17:

```
# We need to set these "--add-opens" so that Spark can run on Java 17 (it needs access to
# parts of the JVM which have been modularized and made internal).
JAVA_17_COMPATABILITY="--add-opens=java.base/sun.nio.ch=ALL-UNNAMED --add-opens=java.base/java.nio=ALL-UNNAMED --add-opens=java.base/java.lang=ALL-UNNAMED --add-opens=java.base/java.util=ALL-UNNAMED --add-opens=java.base/java.util.concurrent=ALL-UNNAMED"

spark-submit \
--conf "spark.driver.extraJavaOptions=$JAVA_17_COMPATABILITY" \
--conf "spark.executor.extraJavaOptions=$JAVA_17_COMPATABILITY" \
--class com.example.R2DataCatalogDemo target/scala-2.12/R2DataCatalogDemo-assembly-1.0.jar
```

Before running it, make sure the script is executable:

```bash
chmod +x submit.sh
```

At this point, your project directory should be structured like this:

<FileTree>
- Makefile
- README.md
- build.sbt
- project
  - assembly.sbt
  - build.properties
  - project
- spark-submit.sh
- src
  - main
	  - scala
		  - com
			  - example
				  - R2DataCatalogDemo.scala
</FileTree>

Before submitting the job, make sure you have the required environment variable set for your catalog URI, warehouse, and [Cloudflare API token](/r2/api/tokens/).

```bash
export CATALOG_URI=
export WAREHOUSE=
export TOKEN=
```

You are now ready to run the job:

```bash
./submit.sh
```

---

# Spark (PySpark)

URL: https://developers.cloudflare.com/r2/data-catalog/config-examples/spark-python/

Below is an example of using [PySpark](https://spark.apache.org/docs/latest/api/python/index.html) to connect to R2 Data Catalog.

## Prerequisites

- Sign up for a [Cloudflare account](https://dash.cloudflare.com/sign-up/workers-and-pages).
- [Create an R2 bucket](/r2/buckets/create-buckets/) and [enable the data catalog](/r2/data-catalog/manage-catalogs/#enable-r2-data-catalog-on-a-bucket).
- [Create an R2 API token](/r2/api/tokens/) with both [R2 and data catalog permissions](/r2/api/tokens/#permissions).
- Install the [PySpark](https://spark.apache.org/docs/latest/api/python/getting_started/install.html) library.

## Example usage

```py
from pyspark.sql import SparkSession

# Define catalog connection details (replace variables)
WAREHOUSE = "<WAREHOUSE>"
TOKEN = "<TOKEN>"
CATALOG_URI = "<CATALOG_URI>"

# Build Spark session with Iceberg configurations
spark = SparkSession.builder \
  .appName("R2DataCatalogExample") \
  .config('spark.jars.packages', 'org.apache.iceberg:iceberg-spark-runtime-3.5_2.12:1.6.1,org.apache.iceberg:iceberg-aws-bundle:1.6.1') \
  .config("spark.sql.extensions", "org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions") \
  .config("spark.sql.catalog.my_catalog", "org.apache.iceberg.spark.SparkCatalog") \
  .config("spark.sql.catalog.my_catalog.type", "rest") \
  .config("spark.sql.catalog.my_catalog.uri", CATALOG_URI) \
  .config("spark.sql.catalog.my_catalog.warehouse", WAREHOUSE) \
  .config("spark.sql.catalog.my_catalog.token", TOKEN) \
  .config("spark.sql.catalog.my_catalog.header.X-Iceberg-Access-Delegation", "vended-credentials") \
  .config("spark.sql.catalog.my_catalog.s3.remote-signing-enabled", "false") \
  .config("spark.sql.defaultCatalog", "my_catalog") \
  .getOrCreate()
spark.sql("USE my_catalog")

# Create namespace if it does not exist
spark.sql("CREATE NAMESPACE IF NOT EXISTS default")

# Create a table in the namespace using Iceberg
spark.sql("""
    CREATE TABLE IF NOT EXISTS default.my_table (
        id BIGINT,
        name STRING
    )
    USING iceberg
""")

# Create a simple DataFrame
df = spark.createDataFrame(
    [(1, "Alice"), (2, "Bob"), (3, "Charlie")],
    ["id", "name"]
)

# Write the DataFrame to the Iceberg table
df.write \
    .format("iceberg") \
    .mode("append") \
    .save("default.my_table")

# Read the data back from the Iceberg table
result_df = spark.read \
    .format("iceberg") \
    .load("default.my_table")

result_df.show()
```

---

# aws CLI

URL: https://developers.cloudflare.com/r2/examples/aws/aws-cli/

import { Render } from "~/components";

<Render file="keys" />
<br />

With the [`aws`](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) CLI installed, you may run [`aws configure`](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html#cli-configure-quickstart-config) to configure a new profile. You will be prompted with a series of questions for the new profile's details.

:::note[Compatibility]
Client versions `2.23.0` and `1.37.0` introduced a modification to the default checksum behavior from the client that is currently incompatible with R2 APIs.

To mitigate, users can use `2.22.35` or `1.36.40`, or alternatively, add the CRC32 checksum flag to the cli command:

```sh
aws s3api put-object --bucket sdk-example --key sdk.png --body file/path --checksum-algorithm CRC32
```

:::

```shell
aws configure
```

```sh output
AWS Access Key ID [None]: <access_key_id>
AWS Secret Access Key [None]: <access_key_secret>
Default region name [None]: auto
Default output format [None]: json
```

You may then use the `aws` CLI for any of your normal workflows.

```sh
aws s3api list-buckets --endpoint-url https://<accountid>.r2.cloudflarestorage.com
# {
#     "Buckets": [
#         {
#             "Name": "sdk-example",
#             "CreationDate": "2022-05-18T17:19:59.645000+00:00"
#         }
#     ],
#     "Owner": {
#         "DisplayName": "134a5a2c0ba47b38eada4b9c8ead10b6",
#         "ID": "134a5a2c0ba47b38eada4b9c8ead10b6"
#     }
# }

aws s3api list-objects-v2 --endpoint-url https://<accountid>.r2.cloudflarestorage.com --bucket sdk-example
# {
#     "Contents": [
#         {
#             "Key": "ferriswasm.png",
#             "LastModified": "2022-05-18T17:20:21.670000+00:00",
#             "ETag": "\"eb2b891dc67b81755d2b726d9110af16\"",
#             "Size": 87671,
#             "StorageClass": "STANDARD"
#         }
#     ]
# }
```

## Generate presigned URLs

You can also generate presigned links which allow you to share public access to a file temporarily.

```sh
# You can pass the --expires-in flag to determine how long the presigned link is valid.
$ aws s3 presign --endpoint-url https://<accountid>.r2.cloudflarestorage.com  s3://sdk-example/ferriswasm.png --expires-in 3600
# https://<accountid>.r2.cloudflarestorage.com/sdk-example/ferriswasm.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=<credential>&X-Amz-Date=<timestamp>&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=<signature>
aws s3 presign --endpoint-url https://<accountid>.r2.cloudflarestorage.com  s3://sdk-example/ferriswasm.png --expires-in 3600
# https://<accountid>.r2.cloudflarestorage.com/sdk-example/ferriswasm.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=<credential>&X-Amz-Date=<timestamp>&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=<signature>
```

---

# aws-sdk-go

URL: https://developers.cloudflare.com/r2/examples/aws/aws-sdk-go/

import { Render } from "~/components";

<Render file="keys" />
<br />

This example uses version 2 of the [aws-sdk-go](https://github.com/aws/aws-sdk-go-v2) package. You must pass in the R2 configuration credentials when instantiating your `S3` service client:

:::note[Compatibility]
Client version `1.73.0` introduced a modification to the default checksum behavior from the client that is currently incompatible with R2 APIs.

To mitigate, users can use `1.72.3` or add the following to their config:

```go
config.WithRequestChecksumCalculation(0)
config.WithResponseChecksumValidation(0)
```

:::

```go
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"log"
)

func main() {
	var bucketName = "sdk-example"
	var accountId = "<accountid>"
	var accessKeyId = "<access_key_id>"
	var accessKeySecret = "<access_key_secret>"

	cfg, err := config.LoadDefaultConfig(context.TODO(),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(accessKeyId, accessKeySecret, "")),
		config.WithRegion("auto"),
	)
	if err != nil {
		log.Fatal(err)
	}

	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
			o.BaseEndpoint = aws.String(fmt.Sprintf("https://%s.r2.cloudflarestorage.com", accountId))
	})

	listObjectsOutput, err := client.ListObjectsV2(context.TODO(), &s3.ListObjectsV2Input{
		Bucket: &bucketName,
	})
	if err != nil {
		log.Fatal(err)
	}

	for _, object := range listObjectsOutput.Contents {
		obj, _ := json.MarshalIndent(object, "", "\t")
		fmt.Println(string(obj))
	}

	//  {
	//  	"ChecksumAlgorithm": null,
	//  	"ETag": "\"eb2b891dc67b81755d2b726d9110af16\"",
	//  	"Key": "ferriswasm.png",
	//  	"LastModified": "2022-05-18T17:20:21.67Z",
	//  	"Owner": null,
	//  	"Size": 87671,
	//  	"StorageClass": "STANDARD"
	//  }

	listBucketsOutput, err := client.ListBuckets(context.TODO(), &s3.ListBucketsInput{})
	if err != nil {
		log.Fatal(err)
	}

	for _, object := range listBucketsOutput.Buckets {
		obj, _ := json.MarshalIndent(object, "", "\t")
		fmt.Println(string(obj))
	}

	// {
	// 		"CreationDate": "2022-05-18T17:19:59.645Z",
	// 		"Name": "sdk-example"
	// }
}
```

## Generate presigned URLs

You can also generate presigned links that can be used to temporarily share public write access to a bucket.

```go
presignClient := s3.NewPresignClient(client)

	presignResult, err := presignClient.PresignPutObject(context.TODO(), &s3.PutObjectInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String("example.txt"),
	})

	if err != nil {
		panic("Couldn't get presigned URL for PutObject")
	}

	fmt.Printf("Presigned URL For object: %s\n", presignResult.URL)
```

---

# aws-sdk-java

URL: https://developers.cloudflare.com/r2/examples/aws/aws-sdk-java/

import { Render } from "~/components";

<Render file="keys" />
<br />

This example uses version 2 of the [aws-sdk-java](https://github.com/aws/aws-sdk-java-v2/#using-the-sdk) package. You must pass in the R2 configuration credentials when instantiating your `S3` service client:

:::note[Compatibility]
Client version `2.30.0` introduced a modification to the default checksum behavior from the client that is currently incompatible with R2 APIs.

To mitigate, users can use `2.29.52` or add the following to their S3Config:

```java
this.requestChecksumCalculation = "when_required",
this.responseChecksumValidation = "when_required"
```

:::

```java
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.S3Configuration;
import java.net.URI;
import java.util.List;

/**
 * Client for interacting with Cloudflare R2 Storage using AWS SDK S3 compatibility
 */
public class CloudflareR2Client {
    private final S3Client s3Client;

    /**
     * Creates a new CloudflareR2Client with the provided configuration
     */
    public CloudflareR2Client(S3Config config) {
        this.s3Client = buildS3Client(config);
    }

    /**
     * Configuration class for R2 credentials and endpoint
     */
    public static class S3Config {
        private final String accountId;
        private final String accessKey;
        private final String secretKey;
        private final String endpoint;

        public S3Config(String accountId, String accessKey, String secretKey) {
            this.accountId = accountId;
            this.accessKey = accessKey;
            this.secretKey = secretKey;
            this.endpoint = String.format("https://%s.r2.cloudflarestorage.com", accountId);
        }

        public String getAccessKey() { return accessKey; }
        public String getSecretKey() { return secretKey; }
        public String getEndpoint() { return endpoint; }
    }

    /**
     * Builds and configures the S3 client with R2-specific settings
     */
    private static S3Client buildS3Client(S3Config config) {
        AwsBasicCredentials credentials = AwsBasicCredentials.create(
            config.getAccessKey(),
            config.getSecretKey()
        );

        S3Configuration serviceConfiguration = S3Configuration.builder()
            .pathStyleAccessEnabled(true)
            .build();

        return S3Client.builder()
            .endpointOverride(URI.create(config.getEndpoint()))
            .credentialsProvider(StaticCredentialsProvider.create(credentials))
            .region(Region.of("auto"))
            .serviceConfiguration(serviceConfiguration)
            .build();
    }

    /**
     * Lists all buckets in the R2 storage
     */
    public List<Bucket> listBuckets() {
        try {
            return s3Client.listBuckets().buckets();
        } catch (S3Exception e) {
            throw new RuntimeException("Failed to list buckets: " + e.getMessage(), e);
        }
    }

    /**
     * Lists all objects in the specified bucket
     */
    public List<S3Object> listObjects(String bucketName) {
        try {
            ListObjectsV2Request request = ListObjectsV2Request.builder()
                .bucket(bucketName)
                .build();

            return s3Client.listObjectsV2(request).contents();
        } catch (S3Exception e) {
            throw new RuntimeException("Failed to list objects in bucket " + bucketName + ": " + e.getMessage(), e);
        }
    }

    public static void main(String[] args) {
        S3Config config = new S3Config(
            "your_account_id",
            "your_access_key",
            "your_secret_key"
        );

        CloudflareR2Client r2Client = new CloudflareR2Client(config);

        // List buckets
        System.out.println("Available buckets:");
        r2Client.listBuckets().forEach(bucket ->
            System.out.println("* " + bucket.name())
        );

        // List objects in a specific bucket
        String bucketName = "demos";
        System.out.println("\nObjects in bucket '" + bucketName + "':");
        r2Client.listObjects(bucketName).forEach(object ->
            System.out.printf("* %s (size: %d bytes, modified: %s)%n",
                object.key(),
                object.size(),
                object.lastModified())
        );
    }
}
```

## Generate presigned URLs

You can also generate presigned links that can be used to temporarily share public write access to a bucket.

```java
// import required packages for presigning
// Rest of the packages are same as above
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import java.time.Duration;

public class CloudflareR2Client {
  private final S3Client s3Client;
  private final S3Presigner presigner;

    /**
     * Creates a new CloudflareR2Client with the provided configuration
     */
    public CloudflareR2Client(S3Config config) {
        this.s3Client = buildS3Client(config);
        this.presigner = buildS3Presigner(config);
    }

    /**
     * Builds and configures the S3 presigner with R2-specific settings
     */
    private static S3Presigner buildS3Presigner(S3Config config) {
        AwsBasicCredentials credentials = AwsBasicCredentials.create(
            config.getAccessKey(),
            config.getSecretKey()
        );

        return S3Presigner.builder()
            .endpointOverride(URI.create(config.getEndpoint()))
            .credentialsProvider(StaticCredentialsProvider.create(credentials))
            .region(Region.of("auto"))
            .serviceConfiguration(S3Configuration.builder()
                .pathStyleAccessEnabled(true)
                .build())
            .build();
    }

    public String generatePresignedUploadUrl(String bucketName, String objectKey, Duration expiration) {
        PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
            .signatureDuration(expiration)
            .putObjectRequest(builder -> builder
                .bucket(bucketName)
                .key(objectKey)
                .build())
            .build();

        PresignedPutObjectRequest presignedRequest = presigner.presignPutObject(presignRequest);
        return presignedRequest.url().toString();
    }

    // Rest of the methods remains the same

    public static void main(String[] args) {
      // config the client as before

      // Generate a pre-signed upload URL valid for 15 minutes
        String uploadUrl = r2Client.generatePresignedUploadUrl(
            "demos",
            "README.md",
            Duration.ofMinutes(15)
        );
        System.out.println("Pre-signed Upload URL (valid for 15 minutes):");
        System.out.println(uploadUrl);
    }

}
```

---

# aws-sdk-js-v3

URL: https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/

import { Render } from "~/components";

<Render file="keys" />
<br />

JavaScript or TypeScript users may continue to use the [`@aws-sdk/client-s3`](https://www.npmjs.com/package/@aws-sdk/client-s3) npm package as per normal. You must pass in the R2 configuration credentials when instantiating your `S3` service client.

:::note
Currently, you cannot use AWS S3-compatible API while developing locally via `wrangler dev`.
:::

:::note[Compatibility]
Client version `3.729.0` introduced a modification to the default checksum behavior from the client that is currently incompatible with R2 APIs.

To mitigate, users can use `3.726.1` or add the following to their S3Client config:

```ts
requestChecksumCalculation: "WHEN_REQUIRED",
responseChecksumValidation: "WHEN_REQUIRED",
```

:::

```ts
import {
	S3Client,
	ListBucketsCommand,
	ListObjectsV2Command,
	GetObjectCommand,
	PutObjectCommand,
} from "@aws-sdk/client-s3";

const S3 = new S3Client({
	region: "auto",
	endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
	credentials: {
		accessKeyId: ACCESS_KEY_ID,
		secretAccessKey: SECRET_ACCESS_KEY,
	},
});

console.log(await S3.send(new ListBucketsCommand({})));
// {
//     '$metadata': {
//     httpStatusCode: 200,
//         requestId: undefined,
//         extendedRequestId: undefined,
//         cfId: undefined,
//         attempts: 1,
//         totalRetryDelay: 0
// },
//     Buckets: [
//     { Name: 'user-uploads', CreationDate: 2022-04-13T21:23:47.102Z },
//     { Name: 'my-bucket-name', CreationDate: 2022-05-07T02:46:49.218Z }
//     ],
//     Owner: {
//         DisplayName: '...',
//         ID: '...'
//     }
// }

console.log(
	await S3.send(new ListObjectsV2Command({ Bucket: "my-bucket-name" })),
);
// {
//     '$metadata': {
//       httpStatusCode: 200,
//       requestId: undefined,
//       extendedRequestId: undefined,
//       cfId: undefined,
//       attempts: 1,
//       totalRetryDelay: 0
//     },
//     CommonPrefixes: undefined,
//     Contents: [
//       {
//         Key: 'cat.png',
//         LastModified: 2022-05-07T02:50:45.616Z,
//         ETag: '"c4da329b38467509049e615c11b0c48a"',
//         ChecksumAlgorithm: undefined,
//         Size: 751832,
//         StorageClass: 'STANDARD',
//         Owner: undefined
//       },
//       {
//         Key: 'todos.txt',
//         LastModified: 2022-05-07T21:37:17.150Z,
//         ETag: '"29d911f495d1ba7cb3a4d7d15e63236a"',
//         ChecksumAlgorithm: undefined,
//         Size: 279,
//         StorageClass: 'STANDARD',
//         Owner: undefined
//       }
//     ],
//     ContinuationToken: undefined,
//     Delimiter: undefined,
//     EncodingType: undefined,
//     IsTruncated: false,
//     KeyCount: 8,
//     MaxKeys: 1000,
//     Name: 'my-bucket-name',
//     NextContinuationToken: undefined,
//     Prefix: undefined,
//     StartAfter: undefined
//   }
```

## Generate presigned URLs

You can also generate presigned links that can be used to share public read or write access to a bucket temporarily.

```ts
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Use the expiresIn property to determine how long the presigned link is valid.
console.log(
	await getSignedUrl(
		S3,
		new GetObjectCommand({ Bucket: "my-bucket-name", Key: "dog.png" }),
		{ expiresIn: 3600 },
	),
);
// https://my-bucket-name.<accountid>.r2.cloudflarestorage.com/dog.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential<credential>&X-Amz-Date=<timestamp>&X-Amz-Expires=3600&X-Amz-Signature=<signature>&X-Amz-SignedHeaders=host&x-id=GetObject

// You can also create links for operations such as putObject to allow temporary write access to a specific key.
console.log(
	await getSignedUrl(
		S3,
		new PutObjectCommand({ Bucket: "my-bucket-name", Key: "dog.png" }),
		{ expiresIn: 3600 },
	),
);
```

You can use the link generated by the `putObject` example to upload to the specified bucket and key, until the presigned link expires.

```sh
curl -X PUT https://my-bucket-name.<accountid>.r2.cloudflarestorage.com/dog.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential<credential>&X-Amz-Date=<timestamp>&X-Amz-Expires=3600&X-Amz-Signature=<signature>&X-Amz-SignedHeaders=host&x-id=PutObject -F "data=@dog.png"
```

---

# aws-sdk-js

URL: https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js/

import { Render } from "~/components";

<Render file="keys" />
<br />

If you are interested in the newer version of the AWS JavaScript SDK visit this [dedicated aws-sdk-js-v3 example page](/r2/examples/aws/aws-sdk-js-v3/).

JavaScript or TypeScript users may continue to use the [`aws-sdk`](https://www.npmjs.com/package/aws-sdk) npm package as per normal. You must pass in the R2 configuration credentials when instantiating your `S3` service client:

```ts
import S3 from "aws-sdk/clients/s3.js";

const s3 = new S3({
	endpoint: `https://${accountid}.r2.cloudflarestorage.com`,
	accessKeyId: `${access_key_id}`,
	secretAccessKey: `${access_key_secret}`,
	signatureVersion: "v4",
});

console.log(await s3.listBuckets().promise());
//=> {
//=>   Buckets: [
//=>     { Name: 'user-uploads', CreationDate: 2022-04-13T21:23:47.102Z },
//=>     { Name: 'my-bucket-name', CreationDate: 2022-05-07T02:46:49.218Z }
//=>   ],
//=>   Owner: {
//=>     DisplayName: '...',
//=>     ID: '...'
//=>   }
//=> }

console.log(await s3.listObjects({ Bucket: "my-bucket-name" }).promise());
//=> {
//=>   IsTruncated: false,
//=>   Name: 'my-bucket-name',
//=>   CommonPrefixes: [],
//=>   MaxKeys: 1000,
//=>   Contents: [
//=>     {
//=>       Key: 'cat.png',
//=>       LastModified: 2022-05-07T02:50:45.616Z,
//=>       ETag: '"c4da329b38467509049e615c11b0c48a"',
//=>       ChecksumAlgorithm: [],
//=>       Size: 751832,
//=>       Owner: [Object]
//=>     },
//=>     {
//=>       Key: 'todos.txt',
//=>       LastModified: 2022-05-07T21:37:17.150Z,
//=>       ETag: '"29d911f495d1ba7cb3a4d7d15e63236a"',
//=>       ChecksumAlgorithm: [],
//=>       Size: 279,
//=>       Owner: [Object]
//=>     }
//=>   ]
//=> }
```

## Generate presigned URLs

You can also generate presigned links that can be used to share public read or write access to a bucket temporarily.

```ts
// Use the expires property to determine how long the presigned link is valid.
console.log(
	await s3.getSignedUrlPromise("getObject", {
		Bucket: "my-bucket-name",
		Key: "dog.png",
		Expires: 3600,
	}),
);
// https://my-bucket-name.<accountid>.r2.cloudflarestorage.com/dog.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=<credential>&X-Amz-Date=<timestamp>&X-Amz-Expires=3600&X-Amz-Signature=<signature>&X-Amz-SignedHeaders=host

// You can also create links for operations such as putObject to allow temporary write access to a specific key.
console.log(
	await s3.getSignedUrlPromise("putObject", {
		Bucket: "my-bucket-name",
		Key: "dog.png",
		Expires: 3600,
	}),
);
```

You can use the link generated by the `putObject` example to upload to the specified bucket and key, until the presigned link expires.

```sh
curl -X PUT https://my-bucket-name.<accountid>.r2.cloudflarestorage.com/dog.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=<credential>&X-Amz-Date=<timestamp>&X-Amz-Expires=3600&X-Amz-Signature=<signature>&X-Amz-SignedHeaders=host --data-binary @dog.png
```

---

# aws-sdk-net

URL: https://developers.cloudflare.com/r2/examples/aws/aws-sdk-net/

import { Render } from "~/components";

<Render file="keys" />
<br />

This example uses version 3 of the [aws-sdk-net](https://www.nuget.org/packages/AWSSDK.S3) package. You must pass in the R2 configuration credentials when instantiating your `S3` service client:

## Client setup

In this example, you will pass credentials explicitly to the `IAmazonS3` initialization. If you wish, use a shared AWS credentials file or the SDK store in-line with other AWS SDKs. Refer to [Configure AWS credentials](https://docs.aws.amazon.com/sdk-for-net/v3/developer-guide/net-dg-config-creds.html) for more details.

:::note[Compatibility]
Client version `3.7.963.0` introduced a modification to the default checksum behavior from the client that is currently incompatible with R2 APIs.

To mitigate, users can use `3.7.962.0` or add the following to their AmazonS3Config:

```csharp
RequestChecksumCalculation = "WHEN_REQUIRED",
ResponseChecksumValidation = "WHEN_REQUIRED"
```

:::

```csharp
private static IAmazonS3 s3Client;

public static void Main(string[] args)
{
	var accessKey = "<ACCESS_KEY>";
	var secretKey = "<SECRET_KEY>";
	var credentials = new BasicAWSCredentials(accessKey, secretKey);
	s3Client = new AmazonS3Client(credentials, new AmazonS3Config
		{
			ServiceURL = "https://<ACCOUNT_ID>.r2.cloudflarestorage.com",
		});
}
```

## List buckets and objects

The [ListBucketsAsync](https://docs.aws.amazon.com/sdkfornet/v3/apidocs/items/S3/MIS3ListBucketsAsyncListBucketsRequestCancellationToken.html) and [ListObjectsAsync](https://docs.aws.amazon.com/sdkfornet/v3/apidocs/items/S3/MIS3ListObjectsV2AsyncListObjectsV2RequestCancellationToken.html) methods can be used to list buckets under your account and the contents of those buckets respectively.

```csharp
static async Task ListBuckets()
{
	var response = await s3Client.ListBucketsAsync();

	foreach (var s3Bucket in response.Buckets)
	{
		Console.WriteLine("{0}", s3Bucket.BucketName);
	}
}
// sdk-example
// my-bucket-name
```

```csharp
static async Task ListObjectsV2()
{
	var request = new ListObjectsV2Request
	{
		BucketName = "sdk-example"
	};

	var response = await s3Client.ListObjectsV2Async(request);

	foreach (var s3Object in response.S3Objects)
	{
		Console.WriteLine("{0}", s3Object.Key);
	}
}
// dog.png
// cat.png
```

## Upload and retrieve objects

The [PutObjectAsync](https://docs.aws.amazon.com/sdkfornet/v3/apidocs/items/S3/MIS3PutObjectAsyncPutObjectRequestCancellationToken.html) and [GetObjectAsync](https://docs.aws.amazon.com/sdkfornet/v3/apidocs/items/S3/MIS3GetObjectAsyncStringStringCancellationToken.html) methods can be used to upload objects and download objects from an R2 bucket respectively.

:::caution

`DisablePayloadSigning = true` must be passed as Cloudflare R2 does not currently support the Streaming SigV4 implementation used by AWSSDK.S3.

:::

```csharp
static async Task PutObject()
{
	var request = new PutObjectRequest
	{
		FilePath = @"/path/file.txt",
		BucketName = "sdk-example",
		DisablePayloadSigning = true
	};

	var response = await s3Client.PutObjectAsync(request);

	Console.WriteLine("ETag: {0}", response.ETag);
}
// ETag: "186a71ee365d9686c3b98b6976e1f196"
```

```csharp
static async Task GetObject()
{
  var bucket = "sdk-example";
  var key = "file.txt"

	var response = await s3Client.GetObjectAsync(bucket, key);

	Console.WriteLine("ETag: {0}", response.ETag);
}
// ETag: "186a71ee365d9686c3b98b6976e1f196"
```

## Generate presigned URLs

The [GetPreSignedURL](https://docs.aws.amazon.com/sdkfornet/v3/apidocs/items/S3/MIS3GetPreSignedURLGetPreSignedUrlRequest.html) method allows you to sign ahead of time, giving temporary access to a specific operation. In this case, presigning a `PutObject` request for `sdk-example/file.txt`.

```csharp
static string? GeneratePresignedUrl()
{
	AWSConfigsS3.UseSignatureVersion4 = true;
	var presign = new GetPreSignedUrlRequest
	{
		BucketName = "sdk-example",
		Key = "file.txt",
		Verb = HttpVerb.GET,
		Expires = DateTime.Now.AddDays(7),
	};

	var presignedUrl = s3Client.GetPreSignedURL(presign);

	Console.WriteLine(presignedUrl);

	return presignedUrl;
}
// URL: https://<accountid>.r2.cloudflarestorage.com/sdk-example/file.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=<credential>&X-Amz-Date=<timestamp>&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=<signature>
```

---

# aws-sdk-php

URL: https://developers.cloudflare.com/r2/examples/aws/aws-sdk-php/

import { Render } from "~/components";

<Render file="keys" />
<br />

This example uses version 3 of the [aws-sdk-php](https://packagist.org/packages/aws/aws-sdk-php) package. You must pass in the R2 configuration credentials when instantiating your `S3` service client:

:::note[Compatibility]
Client version `3.337.0` introduced a modification to the default checksum behavior from the client that is currently incompatible with R2 APIs.

To mitigate, users can use `3.336.15` or add the following to their $options:

```php
'request_checksum_calculation' => 'when_required',
'response_checksum_validation' => 'when_required'
```

:::

```php
<?php
require 'vendor/aws/aws-autoloader.php';

$bucket_name        = "sdk-example";
$account_id         = "<accountid>";
$access_key_id      = "<access_key_id>";
$access_key_secret  = "<access_key_secret>";

$credentials = new Aws\Credentials\Credentials($access_key_id, $access_key_secret);

$options = [
    'region' => 'auto',
    'endpoint' => "https://$account_id.r2.cloudflarestorage.com",
    'version' => 'latest',
    'credentials' => $credentials
];

$s3_client = new Aws\S3\S3Client($options);

$contents = $s3_client->listObjectsV2([
    'Bucket' => $bucket_name
]);

var_dump($contents['Contents']);

// array(1) {
//   [0]=>
//   array(5) {
//     ["Key"]=>
//     string(14) "ferriswasm.png"
//     ["LastModified"]=>
//     object(Aws\Api\DateTimeResult)#187 (3) {
//       ["date"]=>
//       string(26) "2022-05-18 17:20:21.670000"
//       ["timezone_type"]=>
//       int(2)
//       ["timezone"]=>
//       string(1) "Z"
//     }
//     ["ETag"]=>
//     string(34) ""eb2b891dc67b81755d2b726d9110af16""
//     ["Size"]=>
//     string(5) "87671"
//     ["StorageClass"]=>
//     string(8) "STANDARD"
//   }
// }

$buckets = $s3_client->listBuckets();

var_dump($buckets['Buckets']);

// array(1) {
//   [0]=>
//   array(2) {
//     ["Name"]=>
//     string(11) "sdk-example"
//     ["CreationDate"]=>
//     object(Aws\Api\DateTimeResult)#212 (3) {
//       ["date"]=>
//       string(26) "2022-05-18 17:19:59.645000"
//       ["timezone_type"]=>
//       int(2)
//       ["timezone"]=>
//       string(1) "Z"
//     }
//   }
// }

?>
```

## Generate presigned URLs

You can also generate presigned links that can be used to share public read or write access to a bucket temporarily.

```php
$cmd = $s3_client->getCommand('GetObject', [
    'Bucket' => $bucket_name,
    'Key' => 'ferriswasm.png'
]);

// The second parameter allows you to determine how long the presigned link is valid.
$request = $s3_client->createPresignedRequest($cmd, '+1 hour');

print_r((string)$request->getUri())
// https://sdk-example.<accountid>.r2.cloudflarestorage.com/ferriswasm.png?X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=<credential>&X-Amz-Date=<timestamp>&X-Amz-SignedHeaders=host&X-Amz-Expires=3600&X-Amz-Signature=<signature>

// You can also create links for operations such as putObject to allow temporary write access to a specific key.
$cmd = $s3_client->getCommand('PutObject', [
    'Bucket' => $bucket_name,
    'Key' => 'ferriswasm.png'
]);

$request = $s3_client->createPresignedRequest($cmd, '+1 hour');

print_r((string)$request->getUri())
```

You can use the link generated by the `putObject` example to upload to the specified bucket and key, until the presigned link expires.

```sh
curl -X PUT https://sdk-example.<accountid>.r2.cloudflarestorage.com/ferriswasm.png?X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=<credential>&X-Amz-Date=<timestamp>&X-Amz-SignedHeaders=host&X-Amz-Expires=3600&X-Amz-Signature=<signature> --data-binary @ferriswasm.png
```

---

# aws-sdk-ruby

URL: https://developers.cloudflare.com/r2/examples/aws/aws-sdk-ruby/

import { Render } from "~/components";

<Render file="keys" />
<br />

Many Ruby projects also store these credentials in environment variables instead.

:::note[Compatibility]
Client version `1.178.0` introduced a modification to the default checksum behavior from the client that is currently incompatible with R2 APIs.

To mitigate, users can use `1.177.0` or add the following to their s3 client instantiation:

```ruby
request_checksum_calculation: "when_required",
response_checksum_validation: "when_required"
```

:::

Add the following dependency to your `Gemfile`:

```ruby
gem "aws-sdk-s3"
```

Then you can use Ruby to operate on R2 buckets:

```ruby
require "aws-sdk-s3"

@r2 = Aws::S3::Client.new(
  access_key_id: "#{access_key_id}",
  secret_access_key: "#{secret_access_key}",
  endpoint: "https://#{cloudflare_account_id}.r2.cloudflarestorage.com",
  region: "auto",
)

# List all buckets on your account
puts @r2.list_buckets

#=> {
#=>   :buckets => [{
#=>     :name => "your-bucket",
#=>     :creation_date => "…",
#=>   }],
#=>   :owner => {
#=>     :display_name => "…",
#=>     :id => "…"
#=>   }
#=> }

# List the first 20 items in a bucket
puts @r2.list_objects(bucket:"your-bucket", max_keys:20)

#=> {
#=>   :is_truncated => false,
#=>   :marker => nil,
#=>   :next_marker => nil,
#=>   :name => "your-bucket",
#=>   :prefix => nil,
#=>   :delimiter =>nil,
#=>   :max_keys => 20,
#=>   :common_prefixes => [],
#=>   :encoding_type => nil
#=>   :contents => [
#=>     …,
#=>     …,
#=>     …,
#=>   ]
#=> }
```

---

# aws-sdk-rust

URL: https://developers.cloudflare.com/r2/examples/aws/aws-sdk-rust/

import { Render } from "~/components";

<Render file="keys" />
<br />

This example uses the [aws-sdk-s3](https://crates.io/crates/aws-sdk-s3) crate from the [AWS SDK for Rust](https://github.com/awslabs/aws-sdk-rust). You must pass in the R2 configuration credentials when instantiating your `S3` client:

:::note[Compatibility]
Client versions may introduce modifications to the default checksum behavior that could be incompatible with R2 APIs.

If you encounter checksum-related errors, add the following to your config:

```rust
.request_checksum_calculation(RequestChecksumCalculation::WhenRequired)
.response_checksum_validation(ResponseChecksumValidation::WhenRequired)
```

:::

## Basic Usage

```rust
use aws_sdk_s3 as s3;
use aws_smithy_types::date_time::Format::DateTime;

#[tokio::main]
async fn main() -> Result<(), s3::Error> {
    let bucket_name = "sdk-example";
    let account_id = "<accountid>";
    let access_key_id = "<access_key_id>";
    let access_key_secret = "<access_key_secret>";

    // Configure the client
    let config = aws_config::from_env()
        .endpoint_url(format!("https://{}.r2.cloudflarestorage.com", account_id))
        .credentials_provider(aws_sdk_s3::config::Credentials::new(
            access_key_id,
            access_key_secret,
            None, // session token is not used with R2
            None,
            "R2",
        ))
        .region("auto")
        .load()
        .await;

    let client = s3::Client::new(&config);

    // List buckets
    let list_buckets_output = client.list_buckets().send().await?;

    println!("Buckets:");
    for bucket in list_buckets_output.buckets() {
        println!("  - {}: {}",
            bucket.name().unwrap_or_default(),
            bucket.creation_date().map_or_else(
                || "Unknown creation date".to_string(),
                |date| date.fmt(DateTime).unwrap()
            )
        );
    }

    // List objects in a specific bucket
    let list_objects_output = client
        .list_objects_v2()
        .bucket(bucket_name)
        .send()
        .await?;

    println!("\nObjects in {}:", bucket_name);
    for object in list_objects_output.contents() {
        println!("  - {}: {} bytes, last modified: {}",
            object.key().unwrap_or_default(),
            object.size().unwrap_or_default(),
            object.last_modified().map_or_else(
                || "Unknown".to_string(),
                |date| date.fmt(DateTime).unwrap()
            )
        );
    }

    Ok(())
}
```

## Upload Objects

To upload an object to R2:

```rust
use aws_sdk_s3::primitives::ByteStream;
use std::path::Path;

async fn upload_object(
    client: &s3::Client,
    bucket: &str,
    key: &str,
    file_path: &str,
) -> Result<(), s3::Error> {
    let body = ByteStream::from_path(Path::new(file_path)).await.unwrap();

    client
        .put_object()
        .bucket(bucket)
        .key(key)
        .body(body)
        .send()
        .await?;

    println!("Uploaded {} to {}/{}", file_path, bucket, key);
    Ok(())
}
```

## Download Objects

To download an object from R2:

```rust
use std::fs;
use std::io::Write;

async fn download_object(
    client: &s3::Client,
    bucket: &str,
    key: &str,
    output_path: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let resp = client
        .get_object()
        .bucket(bucket)
        .key(key)
        .send()
        .await?;

    let data = resp.body.collect().await?;
    let bytes = data.into_bytes();

    let mut file = fs::File::create(output_path)?;
    file.write_all(&bytes)?;

    println!("Downloaded {}/{} to {}", bucket, key, output_path);
    Ok(())
}
```

## Generate Presigned URLs

You can also generate presigned links that can be used to temporarily share public read or write access to a bucket.

```rust
use aws_sdk_s3::presigning::PresigningConfig;
use std::time::Duration;

async fn generate_get_presigned_url(
    client: &s3::Client,
    bucket: &str,
    key: &str,
    expires_in: Duration,
) -> Result<String, s3::Error> {
    let presigning_config = PresigningConfig::expires_in(expires_in)?;

    // Generate a presigned URL for GET (download)
    let presigned_get_request = client
        .get_object()
        .bucket(bucket)
        .key(key)
        .presigned(presigning_config)
        .await?;

    Ok(presigned_get_request.uri().to_string())
}

async fn generate_upload_presigned_url(
    client: &s3::Client,
    bucket: &str,
    key: &str,
    expires_in: Duration,
) -> Result<String, s3::Error> {
    let presigning_config = PresigningConfig::expires_in(expires_in)?;

    // Generate a presigned URL for PUT (upload)
    let presigned_put_request = client
        .put_object()
        .bucket(bucket)
        .key(key)
        .presigned(presigning_config)
        .await?;

    Ok(presigned_put_request.uri().to_string())
}
```

You can use these presigned URLs with any HTTP client. For example, to upload a file using the PUT URL:

```bash
curl -X PUT "https://<your-presigned-put-url>" -H "Content-Type: application/octet-stream" --data-binary "@local-file.txt"
```

To download a file using the GET URL:

```bash
curl -X GET "https://<your-presigned-get-url>" -o downloaded-file.txt
```

---

# aws4fetch

URL: https://developers.cloudflare.com/r2/examples/aws/aws4fetch/

import { Render } from "~/components";

<Render file="keys" />
<br />

JavaScript or TypeScript users may continue to use the [`aws4fetch`](https://www.npmjs.com/package/aws4fetch) npm package as per normal. This package uses the `fetch` and `SubtleCrypto` APIs which you will be familiar with when working in browsers or with Cloudflare Workers.

You must pass in the R2 configuration credentials when instantiating your `S3` service client:

```ts
import { AwsClient } from "aws4fetch";

const R2_URL = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;

const client = new AwsClient({
	accessKeyId: ACCESS_KEY_ID,
	secretAccessKey: SECRET_ACCESS_KEY,
});

const ListBucketsResult = await client.fetch(R2_URL);
console.log(await ListBucketsResult.text());
// <ListAllMyBucketsResult>
//     <Buckets>
//         <Bucket>
//             <CreationDate>2022-04-13T21:23:47.102Z</CreationDate>
//             <Name>user-uploads</Name>
//         </Bucket>
//         <Bucket>
//             <CreationDate>2022-05-07T02:46:49.218Z</CreationDate>
//             <Name>my-bucket-name</Name>
//         </Bucket>
//     </Buckets>
//     <Owner>
//         <DisplayName>...</DisplayName>
//         <ID>...</ID>
//     </Owner>
// </ListAllMyBucketsResult>

const ListObjectsV2Result = await client.fetch(
	`${R2_URL}/my-bucket-name?list-type=2`,
);
console.log(await ListObjectsV2Result.text());
// <ListBucketResult>
//   <Name>my-bucket-name</Name>
//   <Contents>
//     <Key>cat.png</Key>
//     <Size>751832</Size>
//     <LastModified>2022-05-07T02:50:45.616Z</LastModified>
//     <ETag>"c4da329b38467509049e615c11b0c48a"</ETag>
//     <StorageClass>STANDARD</StorageClass>
//   </Contents>
//   <Contents>
//     <Key>todos.txt</Key>
//     <Size>278</Size>
//     <LastModified> 2022-05-07T21:37:17.150Z</LastModified>
//     <ETag>"29d911f495d1ba7cb3a4d7d15e63236a"</ETag>
//     <StorageClass>STANDARD</StorageClass>
//   </Contents>
//   <IsTruncated>false</IsTruncated>
//   <MaxKeys>1000</MaxKeys>
//   <KeyCount>2</KeyCount>
// </ListBucketResult>
```

## Generate presigned URLs

You can also generate presigned links that can be used to share public read or write access to a bucket temporarily.

```ts
import { AwsClient } from "aws4fetch";

const client = new AwsClient({
	service: "s3",
	region: "auto",
	accessKeyId: ACCESS_KEY_ID,
	secretAccessKey: SECRET_ACCESS_KEY,
});

const R2_URL = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;

// Use the `X-Amz-Expires` query param to determine how long the presigned link is valid.
console.log(
	(
		await client.sign(
			new Request(`${R2_URL}/my-bucket-name/dog.png?X-Amz-Expires=${3600}`),
			{
				aws: { signQuery: true },
			},
		)
	).url.toString(),
);
// https://<accountid>.r2.cloudflarestorage.com/my-bucket-name/dog.png?X-Amz-Expires=3600&X-Amz-Date=<timestamp>&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=<credential>&X-Amz-SignedHeaders=host&X-Amz-Signature=<signature>

// You can also create links for operations such as PutObject to allow temporary write access to a specific key.
console.log(
	(
		await client.sign(
			new Request(`${R2_URL}/my-bucket-name/dog.png?X-Amz-Expires=${3600}`, {
				method: "PUT",
			}),
			{
				aws: { signQuery: true },
			},
		)
	).url.toString(),
);
```

You can use the link generated by the `PutObject` example to upload to the specified bucket and key, until the presigned link expires.

```sh
curl -X PUT "https://<accountid>.r2.cloudflarestorage.com/my-bucket-name/dog.png?X-Amz-Expires=3600&X-Amz-Date=<timestamp>&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=<credential>&X-Amz-SignedHeaders=host&X-Amz-Signature=<signature>" -F "data=@dog.png"
```

---

# boto3

URL: https://developers.cloudflare.com/r2/examples/aws/boto3/

import { Render } from "~/components";

<Render file="keys" />
<br />

You must configure [`boto3`](https://boto3.amazonaws.com/v1/documentation/api/latest/index.html) to use a preconstructed `endpoint_url` value. This can be done through any `boto3` usage that accepts connection arguments; for example:

:::note[Compatibility]
Client version `1.36.0` introduced a modification to the default checksum behavior from the client that is currently incompatible with R2 APIs.

To mitigate, users can use `1.35.99` or add the following to their s3 resource config:

```python
request_checksum_calculation = 'WHEN_REQUIRED',
response_checksum_validation = 'WHEN_REQUIRED'
```

:::

```python
import boto3

s3 = boto3.resource('s3',
  endpoint_url = 'https://<accountid>.r2.cloudflarestorage.com',
  aws_access_key_id = '<access_key_id>',
  aws_secret_access_key = '<access_key_secret>'
)
```

You may, however, omit the `aws_access_key_id` and `aws_secret_access_key ` arguments and allow `boto3` to rely on the `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` [environment variables](https://boto3.amazonaws.com/v1/documentation/api/latest/guide/configuration.html#using-environment-variables) instead.

An example script may look like the following:

```python
import boto3

s3 = boto3.client(
    service_name ="s3",
    endpoint_url = 'https://<accountid>.r2.cloudflarestorage.com',
    aws_access_key_id = '<access_key_id>',
    aws_secret_access_key = '<access_key_secret>',
    region_name="<location>", # Must be one of: wnam, enam, weur, eeur, apac, auto
)

# Get object information
object_information = s3.head_object(Bucket=<R2_BUCKET_NAME>, Key=<FILE_KEY_NAME>)

# Upload/Update single file
s3.upload_fileobj(io.BytesIO(file_content), <R2_BUCKET_NAME>, <FILE_KEY_NAME>)

# Delete object
s3.delete_object(Bucket=<R2_BUCKET_NAME>, Key=<FILE_KEY_NAME>)
```

```sh
python main.py
```

```sh output
Buckets:
 -  user-uploads
 -  my-bucket-name
Objects:
 -  cat.png
 -  todos.txt
```

---

# Configure custom headers

URL: https://developers.cloudflare.com/r2/examples/aws/custom-header/

Some of R2's [extensions](/r2/api/s3/extensions/) require setting a specific header when using them in the S3 compatible API. For some functionality you may want to set a request header on an entire category of requests. Other times you may want to configure a different header for each individual request. This page contains some examples on how to do so with `boto3` and with `aws-sdk-js-v3`.

## Setting a custom header on all requests

When using certain functionality, like the `cf-create-bucket-if-missing` header, you may want to set a constant header for all `PutObject` requests you're making.

### Set a header for all requests with `boto3`

`Boto3` has an event system which allows you to modify requests. Here we register a function into the event system which adds our header to every `PutObject` request being made.

```python
import boto3

client = boto3.resource('s3',
  endpoint_url = 'https://<accountid>.r2.cloudflarestorage.com',
  aws_access_key_id = '<access_key_id>',
  aws_secret_access_key = '<access_key_secret>'
)

event_system = client.meta.events

# Define function responsible for adding the header
def add_custom_header(params, **kwargs):
    params["headers"]['cf-create-bucket-if-missing'] = 'true'

event_system.register('before-call.s3.PutObject', add_custom_header)

response = client.put_object(Bucket="my_bucket", Key="my_file", Body="file_contents")
print(response)
```

### Set a header for all requests with `aws-sdk-js-v3`

`aws-sdk-js-v3` allows the customization of request behavior through the use of its [middleware stack](https://aws.amazon.com/blogs/developer/middleware-stack-modular-aws-sdk-js/). This example adds a middleware to the client which adds a header to every `PutObject` request being made.

```ts
import {
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const client = new S3Client({
  region: "auto",
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});

client.middlewareStack.add(
  (next, context) => async (args) => {
      const r = args.request as RequestInit
      r.headers["cf-create-bucket-if-missing"] = "true";

      return await next(args)
    },
  { step: 'build', name: 'customHeaders' },
)

const command = new PutObjectCommand({
  Bucket: "my_bucket",
  Key: "my_key",
  Body: "my_data"
});

const response = await client.send(command);

console.log(response);
```

## Set a different header on each request

Certain extensions that R2 has provided in the S3 compatible api may require setting a different header on each request. For example, you may want to only want to overwrite an object if its etag matches a certain expected value. This value will likely be different for each object that is being overwritten, which requires the `If-Match` header to be different with each request you make. This section shows examples of how to accomplish that.

### Set a header per request in `boto3`

To enable us to pass custom headers as an extra argument into the call to `client.put_object()` we need to register 2 functions into `boto3`'s event system. This is necessary because `boto3` performs a parameter validation step which rejects extra method arguments. Since this parameter validation occurs before we can set headers on the request, we first need to move the custom argument into the request context before the parameter validation happens. In a subsequent step we can now actually set the headers based on the information we put in the request context.

```python
import boto3

client = boto3.resource('s3',
  endpoint_url = 'https://<accountid>.r2.cloudflarestorage.com',
  aws_access_key_id = '<access_key_id>',
  aws_secret_access_key = '<access_key_secret>'
)

event_system = client.meta.events

# Moves the custom headers from the parameters to the request context
def process_custom_arguments(params, context, **kwargs):
    if (custom_headers := params.pop("custom_headers", None)):
        context["custom_headers"] = custom_headers

# Here we extract the headers from the request context and actually set them
def add_custom_headers(params, context, **kwargs):
    if (custom_headers := context.get("custom_headers")):
        params["headers"].update(custom_headers)

event_system.register('before-parameter-build.s3.PutObject', process_custom_arguments)
event_system.register('before-call.s3.PutObject', add_custom_headers)

custom_headers = {'If-Match' : '"29d911f495d1ba7cb3a4d7d15e63236a"'}

# Note that boto3 will throw an exception if the precondition failed. Catch this exception if necessary
response = client.put_object(Bucket="my_bucket", Key="my_key", Body="file_contents", custom_headers=custom_headers)
print(response)
```

### Set a header per request in `aws-sdk-js-v3`

Here we again configure the header we would like to set by creating a middleware, but this time we add the middleware to the request itself instead of to the whole client.

```ts
import {
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const client = new S3Client({
  region: "auto",
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});

const command = new PutObjectCommand({
  Bucket: "my_bucket",
  Key: "my_key",
  Body: "my_data"
});

const headers = { 'If-Match': '"29d911f495d1ba7cb3a4d7d15e63236a"' }
command.middlewareStack.add(
  (next) =>
    (args) => {
      const r = args.request as RequestInit

      Object.entries(headers).forEach(
        ([k, v]: [key: string, value: string]): void => {
          r.headers[k] = v
        },
      )

      return next(args)
    },
  { step: 'build', name: 'customHeaders' },
)
const response = await client.send(command);

console.log(response);
```

---

# S3 SDKs

URL: https://developers.cloudflare.com/r2/examples/aws/

import { DirectoryListing } from "~/components";

<DirectoryListing />

---

# Snowflake

URL: https://developers.cloudflare.com/r2/reference/partners/snowflake-regions/

import { Render } from "~/components";

This page details which R2 location or jurisdiction is recommended based on your Snowflake region.

You have the following inputs to control the physical location where objects in your R2 buckets are stored (for more information refer to [data location](/r2/reference/data-location/)):

- [**Location hints**](/r2/reference/data-location/#location-hints): Specify a geophrical area (for example, Asia-Pacific or Western Europe). R2 makes a best effort to place your bucket in or near that location to optimize performance. You can confirm bucket placement after creation by navigating to the **Settings** tab of your bucket and referring to the **Bucket details** section.
- [**Jurisdictions**](/r2/reference/data-location/#jurisdictional-restrictions): Enforce that data is both stored and processed within a specific jurisdiction (for example, the EU or FedRAMP environment). Use jurisdictions when you need to ensure data is stored and processed within a jurisdiction to meet data residency requirements, including local regulations such as the [GDPR](https://gdpr-info.eu/) or [FedRAMP](https://blog.cloudflare.com/cloudflare-achieves-fedramp-authorization/).

## North and South America (Commercial)

| Snowflake region name        | Cloud | Region ID        | Recommended R2 location |
| ---------------------------- | ----- | ---------------- | ----------------------- |
| Canada (Central)             | AWS   | `ca-central-1`   | Location hint: `enam`   |
| South America (Sao Paulo)    | AWS   | `sa-east-1`      | Location hint: `enam`   |
| US West (Oregon)             | AWS   | `us-west-2`      | Location hint: `wnam`   |
| US East (Ohio)               | AWS   | `us-east-2`      | Location hint: `enam`   |
| US East (N. Virginia)        | AWS   | `us-east-1`      | Location hint: `enam`   |
| US Central1 (Iowa)           | GCP   | `us-central1`    | Location hint: `enam`   |
| US East4 (N. Virginia)       | GCP   | `us-east4`       | Location hint: `enam`   |
| Canada Central (Toronto)     | Azure | `canadacentral`  | Location hint: `enam`   |
| Central US (Iowa)            | Azure | `centralus`      | Location hint: `enam`   |
| East US 2 (Virginia)         | Azure | `eastus2`        | Location hint: `enam`   |
| Mexico Central (Mexico City) | Azure | `mexicocentral`  | Location hint: `wnam`   |
| South Central US (Texas)     | Azure | `southcentralus` | Location hint: `enam`   |
| West US 2 (Washington)       | Azure | `westus2`        | Location hint: `wnam`   |

## U.S. Government

| Snowflake region name | Cloud | Region ID       | Recommended R2 location |
| --------------------- | ----- | --------------- | ----------------------- |
| US Gov East 1         | AWS   | `us-gov-east-1` | Jurisdiction: `fedramp` |
| US Gov West 1         | AWS   | `us-gov-west-1` | Jurisdiction: `fedramp` |
| US Gov Virginia       | Azure | `usgovvirginia` | Jurisdiction: `fedramp` |

:::note

Cloudflare Enterprise customers may contact their account team or [Cloudflare Support](/support/contacting-cloudflare-support/) to get access to the FedRAMP jurisdiction.
:::

## Europe and Middle East

| Snowflake region name         | Cloud | Region ID          | Recommended R2 location                   |
| ----------------------------- | ----- | ------------------ | ----------------------------------------- |
| EU (Frankfurt)                | AWS   | `eu-central-1`     | Jurisdiction: `eu` or hint: `weur`/`eeur` |
| EU (Zurich)                   | AWS   | `eu-central-2`     | Jurisdiction: `eu` or hint: `weur`/`eeur` |
| EU (Stockholm)                | AWS   | `eu-north-1`       | Jurisdiction: `eu` or hint: `weur`/`eeur` |
| EU (Ireland)                  | AWS   | `eu-west-1`        | Jurisdiction: `eu` or hint: `weur`/`eeur` |
| Europe (London)               | AWS   | `eu-west-2`        | Jurisdiction: `eu` or hint: `weur`/`eeur` |
| EU (Paris)                    | AWS   | `eu-west-3`        | Jurisdiction: `eu` or hint: `weur`/`eeur` |
| Middle East Central2 (Dammam) | GCP   | `me-central2`      | Location hint: `weur`/`eeur`              |
| Europe West2 (London)         | GCP   | `europe-west-2`    | Jurisdiction: `eu` or hint: `weur`/`eeur` |
| Europe West3 (Frankfurt)      | GCP   | `europe-west-3`    | Jurisdiction: `eu` or hint: `weur`/`eeur` |
| Europe West4 (Netherlands)    | GCP   | `europe-west-4`    | Jurisdiction: `eu` or hint: `weur`/`eeur` |
| North Europe (Ireland)        | Azure | `northeurope`      | Jurisdiction: `eu` or hint: `weur`/`eeur` |
| Switzerland North (Zurich)    | Azure | `switzerlandnorth` | Jurisdiction: `eu` or hint: `weur`/`eeur` |
| West Europe (Netherlands)     | Azure | `westeurope`       | Jurisdiction: `eu` or hint: `weur`/`eeur` |
| UAE North (Dubai)             | Azure | `uaenorth`         | Location hint: `weur`/`eeur`              |
| UK South (London)             | Azure | `uksouth`          | Jurisdiction: `eu` or hint: `weur`/`eeur` |

## Asia Pacific and China

| Snowflake region name            | Cloud | Region ID        | Recommended R2 location |
| -------------------------------- | ----- | ---------------- | ----------------------- |
| Asia Pacific (Tokyo)             | AWS   | `ap-northeast-1` | Location hint: `apac`   |
| Asia Pacific (Seoul)             | AWS   | `ap-northeast-2` | Location hint: `apac`   |
| Asia Pacific (Osaka)             | AWS   | `ap-northeast-3` | Location hint: `apac`   |
| Asia Pacific (Mumbai)            | AWS   | `ap-south-1`     | Location hint: `apac`   |
| Asia Pacific (Singapore)         | AWS   | `ap-southeast-1` | Location hint: `apac`   |
| Asia Pacific (Sydney)            | AWS   | `ap-southeast-2` | Location hint: `oc`     |
| Asia Pacific (Jakarta)           | AWS   | `ap-southeast-3` | Location hint: `apac`   |
| China (Ningxia)                  | AWS   | `cn-northwest-1` | Location hint: `apac`   |
| Australia East (New South Wales) | Azure | `australiaeast`  | Location hint: `oc`     |
| Central India (Pune)             | Azure | `centralindia`   | Location hint: `apac`   |
| Japan East (Tokyo)               | Azure | `japaneast`      | Location hint: `apac`   |
| Southeast Asia (Singapore)       | Azure | `southeastasia`  | Location hint: `apac`   |

---