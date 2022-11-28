# cognito-role-magic

This repository intends to make a minimum viable reproduction case of how to:

 1. Use CDK to create a Cognito-User Pool and an -Identity Pool.
 2. Specify roles for authenticated, and unauthenticated users.
 3. Given credentials (username, password) to perform an "admin login" (i.e bypass the authorization_code OAuth2 browser flow).
 4. Convert the resulting idToken from the response into a Cognito Identity ID (specially flavoured UUID).
 5. Convert that Cognito Identity ID into a set of AWS credentials.

Steps 1..3 are just set-up which belong in the CDK, or will happen before any
lambda functions are invoked. Steps 4&5 are the real magic in this set-up. ✨

## Motivation

AWS supports a kind of RBAC natively, where rather than Lambda functions
running in the context of some "prod" credentials which has indiscriminate
access to the entire DynamoDB account, or S3 bucket, we can run the lambda
functions completely without credentials, and permit them to effectively use
AWS Security Token Service (STS) to adopt their own role.

Their own IAM role is then a template containing certain conditional predicates
such as "may only access DynamoDB records where the user id from the auth token
matches the row's primary key" (in other words, they may only access their own
user account "rows" in Dynamo).

Thanks to GSIs (Global Secondary Indexes/Indices) in DynamoDB, a "has many"
type model can also be mapped (a GSI produces it's own, new primary key, based
on some data attribute in the data segment of the underlying table). Since
these GSIs are also primary keys (a GSI is a clone of the underlying table,
managed entirely by AWS, with the primary key modified automagically under the
hood)

## `fp-ts`

This example is largely using `fp-ts` partly because of personal preference,
but partly because the various AWS libraries are so inconsistent in their
design that it warrants wrappnig up in a clean interface.

I am by no means an fp-ts expert and this code should not be held-up as a
reference example; in particular I regularly butcher the use of
ReaderTaskEither, pipe() and TaskEither.
