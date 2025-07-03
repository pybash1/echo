# Echo

Sync your clipboard between your mac and android!

To build the app(yes it is all self hosted) you can use eas or build it locally.

Just make sure, to update the .env with your Proxy URL(`EXPO_PUBLIC_PROXY_URL`) before building the app. The Proxy URL will be the address of wherre you've hosted [echo-proxy](https://github.com/pybash1/echo-proxy). Download the mac app from [echo-mac](https://github.com/pybash1/echo-mac)

With EAS:
`eas build --profile production --platform android`

Locally:
`eas built --profile production --platform android --local`

Then install the app on your phone and your good to go.
