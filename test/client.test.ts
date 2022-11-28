import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  SignUpCommandOutput,
} from "@aws-sdk/client-cognito-identity-provider"; // ES Modules import
import * as AmazonCognitoIdentity from "amazon-cognito-identity-js";
import * as ClientOAuth2 from "client-oauth2";
import { faker } from "@faker-js/faker";
import { URL } from "url";

// create a user with CLI
// $ aws cognito-idp admin-create-user  --user-pool-id "{Please type your userpool id}"  --username "test-user-paprika"
// $ aws cognito-idp admin-set-user-password --user-pool-id "{Please type your userpool id}" --username "test-user-paprika" --password 'Password1234#' --permanent
// (via https://dev.to/aws-builders/how-to-use-amazon-cognito-with-reacttypescript-4elj)

const cognitoDomain = "https://role-magic.auth.eu-central-1.amazoncognito.com";
const cognitoUrl = new URL(cognitoDomain);
const redirectUri = "https://my-app-domain.com/welcome";
const clientId = "3qqv6keae0cq7g8cldq98ebvnh"; // from an App in the associated pool
const poolId = "eu-central-1_sjpZO6EE3";

const oAuth2Client = new ClientOAuth2({
  clientId: "abc",
  accessTokenUri: new URL("/oauth/access_token", cognitoUrl).toString(),
  authorizationUri: new URL("/oauth/authorize", cognitoUrl).toString(),
  redirectUri, // must match the CDK stack definition
  scopes: ["profile", "email"],
});

const cognitoConfiguration = {
  region: "eu-central-1",
};

const cognitoIdpClient = () =>
  new CognitoIdentityProviderClient(cognitoConfiguration);

interface SignUpParams {
  clientId: string;
  username: string;
  password: string;
  email: string;
}

// Can also use this technique here for creating, then authorizing a user
// https://www.stackery.io/blog/authentication-aws-cognito/
const signUp = async ({
  clientId,
  username,
  password,
  email,
}: SignUpParams): Promise<SignUpCommandOutput> => {
  // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-cognito-identity-provider/classes/signupcommand.html
  return cognitoIdpClient().send(
    new SignUpCommand({
      ClientId: clientId,
      Username: username,
      Password: password,
      UserAttributes: [{ Name: "email", Value: email }],
    })
  );
};

interface SignInParams {
  username: string;
  password: string;
  clientId: string;
  poolId: string;
}
// https://aws.amazon.com/blogs/mobile/understanding-amazon-cognito-user-pool-oauth-2-0-grants/
const signIn = async ({
  clientId,
  poolId,
  username,
  password,
}: SignInParams): Promise<unknown> => {
  const userPool = new AmazonCognitoIdentity.CognitoUserPool({
    UserPoolId: poolId,
    ClientId: clientId,
  });
  var userData = {
    Username: username,
    Pool: userPool,
  };
  return new Promise((resolve, reject) =>
    new AmazonCognitoIdentity.CognitoUser(userData).authenticateUser(
      new AmazonCognitoIdentity.AuthenticationDetails({
        Username: username,
        Password: password,
      }),
      { onSuccess: resolve, onFailure: reject }
    )
  );
};

// can also use this to sign up users if we don't have the lambda pre-token thing.
// const confirmSignUp = async ({username, clientId}: SignUpParams): Promise<AdminConfirmSignUpCommandOutput> => {
//     const command = new AdminConfirmSignUpCommand({
//         Username: username,
//         UserPoolId: userPoolId.
//       });
//       return client().send(command);
// }

describe("connecting to aws", () => {
  const email = faker.internet.email();
  const username = email;
  const password = "SuperSecret0101$$";

  console.log({ email });

  beforeAll((done) => {
    signUp({ email, username, password, clientId })
      .then(console.log)
      .catch(console.error)
      .finally(done);
  });

  test("writing some contents to the db", (done) => {
    signIn({ poolId, username, password, clientId })
      .then(console.log)
      .catch(console.error)
      .finally(done);
  });
});
