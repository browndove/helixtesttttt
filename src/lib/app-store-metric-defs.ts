/** Official App Store Connect Analytics metric definitions.
 *  https://developer.apple.com/help/app-store-connect-analytics/reference/metrics-definitions
 */
export const ASC_METRIC_DEFS = {
    impressions:
        'The number of times your app was viewed on the Today, Games, Apps, and Search tabs of the App Store for more than one second. Includes product page views.',
    unique_impressions:
        'The number of unique devices that have viewed your app on the Today, Games, Apps, and Search tabs of the App Store. Includes unique product page views.',
    conversion:
        'Total downloads and pre-orders divided by unique device impressions. When a user pre-orders an app, it counts towards your conversion rate. It is not counted again when it downloads to their device.',
    page_views:
        'The total number of times your App Store product page was viewed. Includes when apps use StoreKit to load your product page.',
    unique_page_views:
        'The number of unique devices that have viewed your App Store product page. Includes when apps use StoreKit to load your product page.',
    updates:
        'The total number of app updates. Includes auto-updates.',
    first_time_downloads:
        'The number of first-time downloads on devices with iOS, macOS, tvOS, or visionOS.',
    redownloads:
        'The total number of redownloads of your app on the App Store. Does not include auto-updates or device restores. Counted when a customer clicks the redownload button.',
    total_downloads:
        'The sum of First Time Downloads and Redownloads.',
    installations:
        'The total number of times your app has been installed on devices running a minimum of iOS 8, macOS 11, tvOS 9, or visionOS 1. Redownloads on the same device, downloads to multiple devices sharing the same Apple Account, and Family Sharing installations are included. Only completed installations are counted. Failed or incomplete installations are not included.',
    sessions:
        'The number of times the app has been used for at least two seconds. If the app is in the background and is later used again, that counts as another session.',
    active_devices:
        'The number of devices with at least one session during the selected period. Based on devices running a minimum of iOS 8, macOS 11, tvOS 9, or visionOS 1.',
    active_last_30_days:
        'The number of active devices with at least one session during the previous 30 days.',
    crashes:
        'The total number of crashes on devices running a minimum of iOS 8, macOS 11, tvOS 9, or visionOS 1. Get detailed crash logs and crash reports in Xcode, such as unique totals for each type of crash and how many users experienced it.',
    deletions:
        'The number of times your app was deleted on devices running a minimum of iOS 12.3, macOS 11, tvOS 9, or visionOS 1. This data includes deletions of the app from the Home Screen and deletions of the app through Manage Storage. Data from resetting or erasing a device\'s content and settings is not included.',
    avg_rating:
        'Average star rating from App Store ratings in the selected window.',
} as const;

/** Official Google Play Console metric definitions.
 *  https://support.google.com/googleplay/android-developer/answer/139628
 */
export const PLAY_METRIC_DEFS = {
    users:
        'An individual Google Play user; a user may have multiple devices. This category includes metrics counted at the user level.',
    user_acquisitions:
        'The number of users who installed your app and did not have it installed on any other devices at the time. This includes users who activate a device on which your app is preinstalled or reactivate a device.',
    daily_users:
        'Daily user installs from Play bulk reports. Unique Google Play users who installed the app that day. Does not match Console New users, which also includes preinstalls and reactivations.',
    devices:
        'An Android device associated with a user. If a device is reset or transferred to a different user, it’s counted as a new device. This category includes metrics counted at the device level.',
    install_base:
        'The number of active devices on which your app is installed. An active device is one that has been turned on at least once in the past 30 days.',
    device_acquisition:
        'Install events from Play bulk reports. Devices that installed the app that day. A user installing on two devices counts twice. This is the Android installs figure.',
    device_loss:
        'The number of devices from which users uninstalled your app. This includes when a device has not been used in over 30 days (making them inactive, and counting as deactivation).',
    device_updates:
        'The number of devices on which your app has been updated.',
    listing_visitors:
        'The number of users that visited your store listing who did not have your app installed on any device.',
    listing_acquisitions:
        'The number of users that visited your store listing and installed your app, who did not have your app installed on any device.',
    listing_conversion:
        'The percentage of store listing visitors who installed your app. Note: Does not include visits or installs from users who already have your app installed on another device.',
    crashes:
        'Crash reports collected from Android devices whose users have opted in to automatically share usage and diagnostics data.',
    anrs:
        'Application not responding (ANR) reports collected from Android devices whose users have opted in to automatically share usage and diagnostics data.',
    average_rating:
        'Average star rating your app has received across all ratings submitted.',
} as const;

/** Dimension / chart copy for (i) tooltips that are not a single store metric. */
export const ANALYTICS_CHART_DEFS = {
    sources:
        'How people reached the listing. App Store Search, Browse, and referrers on iOS; Play Search, Explore, and referrals on Android.',
    territories:
        'Country or region of the store visit or install. App Store uses territory; Play uses the device country.',
    devices:
        'Device family or model attributed to the visit, download, or crash.',
    referrers:
        'Apps or websites that sent traffic to the product page. Apple reports app and web referrers separately; Play reports search terms above privacy thresholds.',
    campaigns:
        'Campaign-attributed downloads from App Store campaigns, custom product pages, or Play UTM parameters.',
    page_types:
        'iOS: which App Store surface was viewed (product page, Today, Games, Apps, or Search). Android: Play reports traffic source instead of App Store page type.',
    product_pages:
        'iOS: traffic and downloads by App Store product page, including custom product pages. Android: Play does not split by custom product page; use traffic source and UTM instead.',
    versions:
        'App version associated with the install, session, update, or crash.',
    crashes:
        'Crash reports by version or device. iOS is opt-in usage data; Play vitals are from users who share diagnostics.',
    anrs:
        'Android: Application Not Responding reports from Play vitals, grouped by app version, device, or OS. iOS does not report ANRs; use crashes instead.',
    retention:
        'iOS: share of opt-in devices that return on day 1, 7, 14, and 28 after first use. Android: Play bulk reports do not export D1–D28 cohorts; use install base, uninstalls, and vitals instead.',
    reviews:
        'Written reviews posted to the App Store and Google Play in the selected window. Star ratings without text are omitted.',
    regions:
        'Installs by country. Split bars show iOS App Store territory versus Play country when both stores are selected.',
    funnel:
        'Discovery to install. iOS: Impressions → Product Page Views → Total Downloads. Android: Store listing visitors → listing acquisitions → daily users. Daily users are unique Play users, not device installs.',
    play_attributes:
        'Android: carrier, OS version, and language attached to store listing visits and installs. iOS: use Device and OS version breakdowns instead.',
    mix:
        'Share of the selected metric across the top values. Remaining rows are grouped as Other.',
    updates_vs_upgrades:
        'iOS Updates include auto-updates. Play Device updates count devices that installed a new version of the app.',
} as const;

/** Stack iOS and Android copy so every (i) tooltip covers both stores. */
export function storeMetricInfo(ios?: string, play?: string): string {
    return [
        `iOS · App Store Connect\n${ios?.trim() || 'No matching App Store Connect metric for this Play figure.'}`,
        `Android · Google Play\n${play?.trim() || 'No matching Play Console metric for this App Store figure.'}`,
    ].join('\n\n');
}

export type AscMetricId = keyof typeof ASC_METRIC_DEFS;
export type PlayMetricId = keyof typeof PLAY_METRIC_DEFS;
