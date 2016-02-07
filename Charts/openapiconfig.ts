var getOpenApiConfig = function (baseUrl) {

    return {
        BASE_URL: baseUrl,
        STREAMING_CONNECTION_URL: baseUrl + "/streaming/connection",
        STREAMING_KEEP_ALIVE_URL: baseUrl + "/root/subscriptions/keepalive",
        CHART_URL: baseUrl + "/chart/v1/charts",
        SUBSCRIPTION_URL: baseUrl + "/chart/v1/charts/subscriptions"
    }
}