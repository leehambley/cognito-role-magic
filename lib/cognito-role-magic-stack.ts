import { Construct } from 'constructs'
import * as cdk from 'aws-cdk-lib'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as cognitoAlpha from '@aws-cdk/aws-cognito-identitypool-alpha'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import { CloudDirectory } from 'aws-sdk'

// https://bobbyhadz.com/blog/aws-cdk-iam-role
// https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-adjacency-graphs.html
// https://docs.aws.amazon.com/cognito/latest/developerguide/role-based-access-control.html
// https://github.com/martzcodes/blog-isolation
// https://www.youtube.com/watch?v=9pvygKIuCpI

export class CognitoRoleMagicStack extends cdk.Stack {
  constructor (scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    const userPool = new cognito.UserPool(this, 'MyUserPool', {
      signInCaseSensitive: false,
      selfSignUpEnabled: true,
      autoVerify: { email: true },
      lambdaTriggers: {
        // https://stackoverflow.com/a/53202073/119669
        preSignUp: new lambda.Function(this, 'MyFunction', {
          runtime: lambda.Runtime.NODEJS_16_X,
          handler: 'index.handler',
          code: lambda.Code.fromInline(`
            exports.handler = (event, context, callback) => {
              event.response.autoConfirmUser = true;
              event.response.autoVerifyEmail = true;  // this is NOT needed if e-mail is not in attributeList
              context.done(null, event);
            };
          `)
        })
      }
    })

    userPool.addClient('app-client', {
      generateSecret: false,
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [ cognito.OAuthScope.OPENID ],
        callbackUrls: [ 'https://my-app-domain.com/welcome', 'https://oauth.pstmn.io/v1/callback' ],
        logoutUrls: [ 'https://my-app-domain.com/signin' ],
      },
    });

    const domain = userPool.addDomain('MyDomain', {
      cognitoDomain: {
        domainPrefix: 'role-magic',
      },
    });

    // const idpTrustPolicy = new iam.PolicyDocument({
    //   statements: [
    //     new iam.PolicyStatement({
    //       effect: iam.Effect.ALLOW,
    //       principals: [
    //         new iam.FederatedPrincipal('cognito-identity.amazonaws.com')
    //       ],
    //       actions: ['sts:AssumeRoleWithWebIdentity'],
    //       conditions: [
    //         {
    //           StringEquals: {
    //             'cognito-identity.amazonaws.com:aud': userPool.userPoolId
    //           }
    //         },
    //         {
    //           'ForAnyValue:StringLike': {
    //             'cognito-identity.amazonaws.com:amr': 'authenticated'
    //           }
    //         }
    //       ]
    //     })
    //   ]
    // })

    const usersTable = new dynamodb.Table(this, 'Table', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING }
    })

    const userManageOwnDynamoRows = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          resources: [usersTable.tableArn],
          actions: [
            'dynamodb:GetItem',
            'dynamodb:PutItem',
            'dynamodb:Query'
          ],
          conditions: {
            'ForAllValues:StringEquals': {
              'dynamodb:LeadingKeys': [
                /* eslint no-template-curly-in-string: "off" */
                '${www.amazon.com:user_id}'
              ]
            }
          }
        }),

        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          resources: [`${usersTable.tableArn}/*`], // required for Global Secondary Indexes
          actions: [
            // In Event-Sourcing things don't get removed
            // or modified.
            // "dynamodb:Scan",
            // "dynamodb:DeleteItem",
            // "dynamodb:UpdateItem",
            'dynamodb:GetItem',
            'dynamodb:PutItem',
            'dynamodb:Query'
          ],
          conditions: {
            'ForAllValues:StringEquals': {
              'dynamodb:LeadingKeys': [
                /* eslint no-template-curly-in-string: "off" */
                '${www.amazon.com:user_id}'
              ]
            }
          }
        }),

        new iam.PolicyStatement({
          effect: iam.Effect.DENY,
          resources: [usersTable.tableArn],
          actions: [
            // In Event-Sourcing things don't get removed
            // or modified.
            'dynamodb:Scan',
            'dynamodb:DeleteItem',
            'dynamodb:UpdateItem'
          ]
        })
      ]
    })

    const role = new iam.Role(this, 'Role', {
      assumedBy: new iam.ServicePrincipal('cognito-idp.amazonaws.com'),
      inlinePolicies: {
        ManageOwnDynamoRows: userManageOwnDynamoRows
      }
    })

    // const identityPool = new cognitoAlpha.IdentityPool(this, 'MyIdentityPool', {
    //   authenticationProviders: {
    //     userPools: [
    //       new cognitoAlpha.UserPoolAuthenticationProvider({ userPool })
    //     ]
    //   },
    //   authenticatedRole: role
    // })

    // const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
    //   userPool,
    //   generateSecret: false // Don't need to generate secret for web app running on browsers
    // })

    new cdk.CfnOutput(this, 'awsRegion', { value: cdk.Stack.of(this).region })
    // new cdk.CfnOutput(this, 'oAuth2Client', {
    //   value: JSON.stringify({
    //     client_id: userPoolClient.userPoolClientId,
    //     client_secret: undefined // not set because it makes auth easier.
    //     // client_secret: userPoolClient.userPoolClientSecret,
    //   })
    // })
    // new cdk.CfnOutput(this, 'userPool', {
    //   value: JSON.stringify({
    //     userPoolId: userPool.userPoolId,
    // })

    new cdk.CfnOutput(this, 'cognitoDomain', {
      value: domain.domainName
    })
  }
}
