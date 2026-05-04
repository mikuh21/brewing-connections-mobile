# Development Setup

**Backend:** https://brewing-hub.online (live on Railway)  
**Mobile:** Expo Go on iPhone, developed on Windows PowerShell

---

## Daily Development Workflow

### Start Development
1. Open Windows PowerShell
2. Navigate to mobile folder: `cd C:\brewhub\mobile`
3. Start Expo: `npx expo start`
4. Scan QR code with iPhone Camera app
5. Opens automatically in Expo Go

### API is already live
- No need for ngrok or local server
- API URL: https://brewing-hub.online
- All changes to backend require git push to redeploy

### End of Session - Sync to WSL for Git

Run these commands in PowerShell:

```powershell
xcopy "C:\brewhub\mobile\app" "\\wsl.localhost\Ubuntu\home\laravel-app\laravel-app\brewing-connections\mobile\app" /E /I /Y
copy "C:\brewhub\mobile\App.js" "\\wsl.localhost\Ubuntu\home\laravel-app\laravel-app\brewing-connections\mobile\App.js"
copy "C:\brewhub\mobile\package.json" "\\wsl.localhost\Ubuntu\home\laravel-app\laravel-app\brewing-connections\mobile\package.json"
```

Then in WSL terminal:

```bash
cd ~/laravel-app/brewing-connections/mobile
git add .
git commit -m "your message"
git push
```

---

## Admin Side Functionality Summary

The admin side serves as the central control panel of the BrewHub system. It allows the administrator to monitor platform activity, manage users and businesses, review content, and maintain data quality across the web and mobile experience.

### 1. Dashboard
The dashboard gives the administrator a quick summary of the platform. It shows the total number of establishments, consumer registrations, active marketplace listings, and current promo-related activity. It also displays the most frequently visited locations based on coffee trail usage and map marker views.

### 2. Notifications
The notifications area helps the administrator stay aware of recent activity. It highlights new user registrations, reseller registrations, and other important updates that may require attention.

### 3. Map Management
The map page is used to manage location-based data in the system. It allows the administrator to view all establishments on the map, check verified reseller locations, add new places, update pin locations, and remove establishments when necessary. It also presents useful place details such as ratings, coffee varieties, and active promos.

### 4. Establishment Management
This section contains the complete list of farms, cafes, and roasters registered in the system. It helps the administrator review business records, check ownership details, and remove establishments when needed.

### 5. Consumer Registration Management
This page allows the administrator to review consumer accounts. The administrator can filter accounts by status or time period and deactivate accounts when necessary.

### 6. Reseller Management
The reseller section is used to review reseller accounts, verify qualified resellers, and deactivate accounts when needed. It also helps the administrator distinguish between verified and unverified resellers.

### 7. Coupon Promo Management
This area is used to monitor coupon promos created by cafes. The administrator can review active and expired promos, inspect their details, and delete promo records when necessary.

### 8. Rating Moderation
The rating moderation page helps the administrator monitor user feedback. It now separates cafe ratings and farm product ratings into different tabs for easier review. This makes it easier to inspect reviews, identify recent activity, and remove inappropriate rating entries when necessary.

### 9. Recommendations Monitoring
The recommendations page presents performance insights based on customer ratings. It helps the administrator identify weak areas such as taste, environment, cleanliness, or service. It also groups recommendations by priority level so that concerns can be recognized more easily.

### 10. Marketplace Oversight
The marketplace page gives the administrator visibility over listed products, reseller products, customer orders, and bulk orders. Its purpose is mainly monitoring and control of marketplace-related activity.

## Simple Process Flow: Admin Map

The admin map can be understood as the system's main location management board.

1. The system loads saved establishments and verified reseller locations from the database.
2. These records are shown as pins on the map using their saved coordinates.
3. When a pin is selected, the map can show the place details, such as name, address, ratings, coffee varieties, and active promos.
4. If the administrator adds a new place, the administrator fills in its business details and map location.
5. If the new place is a cafe or roaster, the system links it to a dedicated owner account using the provided email. If the owner account does not yet exist, the system can create one.
6. If the place is a farm, it follows the farm-owner linking setup already defined in the system.
7. After saving, the new establishment becomes part of the platform's shared location data.
8. If a pin location is incorrect, the administrator can update its coordinates so the map stays accurate.

In simple terms, the map process is about adding places, placing them correctly, linking them to the proper owner, and keeping location information accurate.

## Simple Process Flow: Recommendations

The recommendations feature can be understood as an automatic review analysis process.

1. The system reads customer ratings for each establishment.
2. It checks the average scores for taste, environment, cleanliness, and service.
3. It identifies which area has the weakest performance.
4. It assigns a priority level based on how low the score is.
5. It then creates a recommendation or suggested action for improvement.
6. These recommendations are saved and shown on the admin recommendations page.
7. When the administrator refreshes the page insights, the system recalculates the recommendations using the latest available ratings.

In simple terms, the recommendation flow turns customer feedback into clear guidance on what each establishment should improve first.

## Key Difference Between Map and Recommendations

The map is focused on location and ownership management.
The recommendations page is focused on service quality and performance improvement.

In other words, the map answers where places are and who they belong to, while recommendations answer how those places are performing based on customer feedback.

## Defense-Ready Script: Admin Side

Good day. For the admin side of BrewHub, the main purpose is to serve as the central management and monitoring panel of the system.

First, the dashboard gives the administrator a quick overview of the platform. It presents important counts and activity summaries, such as the number of establishments, user registrations, active listings, and frequently visited locations.

Second, the notifications section helps the administrator stay updated on recent activities that may require attention, such as new registrations and other system events.

Third, the map management page is used to manage all location-based records in the system. Through this page, the administrator can view mapped establishments, check reseller locations, add new places, update coordinates, and remove records when necessary.

Fourth, the establishment management page provides a complete list of farms, cafes, and roasters. This allows the administrator to review business records and maintain accurate establishment information.

Fifth, the consumer registration management page allows the administrator to monitor consumer accounts and deactivate them when necessary.

Sixth, the reseller management page is used to review reseller accounts, verify legitimate resellers, and deactivate accounts when needed.

Seventh, the coupon promo management page allows the administrator to inspect active and expired promotions created by cafes and remove promo records if necessary.

Eighth, the rating moderation page helps the administrator review feedback from users. In the current setup, cafe ratings and farm product ratings are separated into different tabs to make moderation clearer and more organized.

Ninth, the recommendations page presents system-generated insights based on customer ratings. It helps identify which area of an establishment needs improvement, such as taste, environment, cleanliness, or service.

Finally, the marketplace oversight page allows the administrator to monitor products, reseller products, and order activity across the platform.

## Defense-Ready Script: Map Flow

For the map flow, the process is simple.

The system first loads the saved establishments and verified reseller locations from the database. These are then displayed on the map as pins based on their saved coordinates. When the administrator selects a pin, the system can display the place details, including its name, location, ratings, coffee varieties, and active promotions.

If the administrator wants to add a new place, the administrator enters the business information and assigns its map location. If the new place is a cafe or roaster, the system links it to a proper owner account using the provided email. If the account does not yet exist, the system can create one. Once saved, the place becomes part of the system's official map data. If a location is incorrect, the administrator can simply update the pin coordinates.

In summary, the map flow is used to add, position, link, and maintain establishments accurately in the system.

## Defense-Ready Script: Recommendations Flow

For the recommendations flow, the system works by analyzing customer ratings.

It reads the ratings submitted for each establishment and computes the average scores for taste, environment, cleanliness, and service. After that, it identifies which area has the lowest performance. Based on the result, the system assigns a priority level and generates a suggested action for improvement. These recommendations are then displayed on the admin recommendations page.

If the administrator refreshes the recommendation insights, the system recalculates them using the latest ratings available. This means the recommendations remain updated as new customer feedback is received.

In summary, the recommendation flow transforms customer reviews into clear and practical guidance for improvement.

## Defense-Ready Closing Line

To summarize, the admin side of BrewHub is designed to help the administrator manage the platform efficiently. The map supports accurate location and ownership management, while the recommendations feature supports quality improvement by turning customer feedback into actionable insights.

---

## Farm Owner Side Functionality Summary

The farm owner side serves as the management area for farm-based businesses in BrewHub. It allows farm owners to maintain their farm profile, manage products, monitor orders, respond to customer activity, and view location-based and marketplace-related information.

### 1. Dashboard
The dashboard gives the farm owner a quick overview of farm activity. It shows the number of listed products, recent orders, trail visits, farm clicks, popularity score, and recent activity. This helps the farm owner monitor business performance at a glance.

### 2. My Farm
The My Farm page is used to manage the farm profile. It allows the farm owner to update the farm name, description, image, address, barangay, contact details, website, operating hours, map coordinates, and coffee varieties. This ensures that the farm's public information remains complete and accurate.

### 3. Marketplace
The marketplace page allows the farm owner to manage products and monitor selling activity. It includes the farm owner's own products, the wider marketplace view, customer orders, and product ratings. Through this page, the farm owner can create products, update product details, adjust stock, control product visibility, and manage order status.

### 4. Notifications
The notifications feature helps the farm owner stay updated on important activities. It highlights pending orders and unread chat messages so that the farm owner can respond quickly to customer needs and communication.

### 5. Map
The map page allows the farm owner to view establishments and verified reseller locations in a geographic view. It provides location awareness across the network and helps the farm owner see farms, cafes, and related business points together with useful place details.

### 6. Messages
The messages section allows the farm owner to communicate directly with other users in the system. It supports conversation creation, message sending, message viewing, and unread tracking.

## Simple Process Flow: Farm Owner Marketplace

The farm owner marketplace can be understood as the main selling and order management area.

1. The farm owner opens the marketplace page.
2. The system loads the farm owner's products linked to the active farm.
3. The system also loads customer orders related to those farm products.
4. If product ratings are available, the system also displays those ratings for review.
5. The farm owner can add a new product by entering its name, category, price, stock, unit, minimum order quantity, description, and image.
6. The farm owner can edit existing product details when updates are needed.
7. The farm owner can also turn product visibility on or off, depending on whether the item should appear in the marketplace.
8. When customer orders come in, the farm owner can update the order status, such as pending, confirmed, completed, or cancelled.

In simple terms, the marketplace flow helps the farm owner list products, manage stock and visibility, and handle incoming orders.

## Simple Process Flow: Farm Owner Profile

The farm profile flow is mainly focused on keeping the farm's information updated.

1. The farm owner opens the My Farm page.
2. The system loads the currently active farm profile.
3. The farm owner updates the farm details, such as name, description, location, contact details, and coffee varieties.
4. If needed, the farm owner uploads a new farm image.
5. After saving, the updated information becomes the current farm profile used in the system.

In simple terms, this flow ensures that the farm's information stays complete, accurate, and ready to be shown across the platform.

## Defense-Ready Script: Farm Owner Side

Good day. For the farm owner side of BrewHub, the main purpose is to provide farm owners with a dedicated space to manage their farm information, products, sales activity, and communication.

First, the dashboard gives the farm owner a summary of business performance. It shows listed products, recent orders, trail visits, farm clicks, popularity score, and recent activity.

Second, the My Farm page allows the farm owner to manage the farm profile. This includes updating the farm name, description, address, contact details, map location, image, and coffee varieties.

Third, the marketplace page serves as the main product and order management area. Through this page, the farm owner can add products, update product information, manage stock, control visibility, review product ratings, and monitor customer orders.

Fourth, the notifications feature helps the farm owner stay informed about important activity, especially pending orders and unread messages.

Fifth, the map page gives the farm owner a location-based view of establishments and verified reseller locations in the system.

Finally, the messages section allows the farm owner to communicate directly with other users through the built-in chat feature.

Overall, the farm owner side is designed to support day-to-day farm business operations within the BrewHub platform.

## Defense-Ready Closing Line: Farm Owner Side

To summarize, the farm owner side of BrewHub is designed to help farm owners manage their business operations more effectively. It combines profile management, product selling, order handling, notifications, mapping, and messaging into one working environment.

---

## Cafe Owner Side Functionality Summary

The cafe owner side serves as the management area for cafe-based businesses in BrewHub. It allows cafe owners to maintain cafe information, manage products and orders, create promotions, review customer feedback, monitor recommendation insights, and communicate with users through the system.

### 1. Dashboard
The dashboard provides a quick overview of cafe performance. It shows trail visits, cafe clicks, popularity score, listed products, recommendation activity, and recent business activity. This helps the cafe owner monitor the overall condition of the cafe in one view.

### 2. My Cafe
The My Cafe page is used to maintain the cafe profile. It allows the cafe owner to update the cafe name, description, address, barangay, operating hours, contact details, website, image, coordinates, and coffee varieties. This keeps the cafe's public information complete and accurate.

### 3. Coupon Promos
The coupon promos page allows the cafe owner to create, update, monitor, redeem, and delete promotional offers. It also shows promo counts such as active, expired, and draft promos. This feature supports customer engagement and promo redemption tracking.

### 4. Marketplace
The marketplace page allows the cafe owner to manage products, review marketplace listings, and handle customer orders. It supports product creation, product updates, product visibility control, and order status updates. It also supports menu item extraction and confirmation for product setup.

### 5. Recommendation Insights
The recommendations page helps the cafe owner understand customer feedback in a more structured way. It uses a rule-based prescriptive analytics engine, meaning the system follows fixed scoring rules and category thresholds instead of AI model training. It shows average ratings, rating distribution, priority levels, category averages, weekly and monthly insight filters, latest reviews, and recommendation history. It also allows the cafe owner to respond to customer reviews.

### 6. Map
The map page gives the cafe owner a geographic view of establishments and verified reseller locations. This helps the cafe owner see the business network in relation to nearby farms, cafes, and resellers.

### 7. Messages
The messages page allows the cafe owner to create conversations, read messages, send replies, and manage direct communication with other users in the system.

### 8. Notifications
The notifications feature helps the cafe owner stay updated on pending orders and unread messages. This supports faster response to both sales activity and communication.

## Simple Process Flow: Cafe Owner Coupon Promos

The coupon promo flow can be understood as the process of creating, managing, and redeeming promotional offers for cafe customers.

1. The cafe owner opens the Coupon Promos page.
2. The system loads the cafe owner's existing promos and groups them into active, expired, and draft records.
3. If the cafe owner wants to create a new promo, the cafe owner enters the promo title, description, discount type, discount value, valid dates, usage limit, and status.
4. The system saves the promo under the cafe owner's establishment and automatically generates a QR code token for redemption.
5. If the promo is edited later, the system updates the same promo details and rechecks whether the promo should remain active or become expired.
6. When a customer presents a promo QR code, the cafe owner uses the redeem scan function.
7. The system reads the QR payload and checks whether the promo token is valid, whether the consumer is valid, whether the promo still exists, whether it is still active, and whether the usage limit has already been reached.
8. The system also checks whether the same consumer has already redeemed that promo before.
9. If all checks pass, the redemption is recorded and the used count is updated.
10. If the promo reaches its maximum usage or is no longer valid, the system prevents further redemption.

In simple terms, the coupon promo flow helps the cafe owner create promo offers, monitor their status, and safely redeem them using QR-based validation.

## Simple Process Flow: Cafe Owner Recommendation Insights

The recommendation insights flow can be understood as a rule-based review analysis process for the cafe.

Recommended term:
This feature can be called a rule-based prescriptive analytics engine or a rule-based recommendation system.

1. The cafe owner opens the Recommendations page.
2. The system first identifies the cafe establishment linked to the logged-in cafe owner.
3. It gathers all ratings connected to that specific cafe only.
4. It counts how many reviews the cafe currently has and computes the average overall rating.
5. It also computes the rating distribution, such as how many 1-star, 2-star, 3-star, 4-star, and 5-star reviews the cafe received.
6. After that, it computes the average score for each main experience category: taste, environment, cleanliness, and service.
7. The system then compares those category averages and identifies which category has the lowest score.
8. Based on that lowest score, the system assigns a priority level, such as high, medium, or low, to show how urgent the issue is.
9. The system prepares separate insight views for weekly, monthly, and all-time periods so the cafe owner can compare current and broader performance.
10. For each selected period, the system checks whether ratings are available in that time range before generating insights.
11. If ratings exist, the system builds descriptive and prescriptive insight cards for each category using the computed averages, total review count, and the latest generated recommendation data.
12. The rule-based part happens here: the system checks each category score against fixed thresholds to classify it as high, medium, or low priority.
13. It then uses predefined descriptive statements and predefined suggested actions for each category and priority level.
14. The category with the weakest score is placed first so the most important concern is shown immediately.
15. The system also rebuilds and reads recommendation snapshot sets so historical recommendation records stay aligned with the latest ratings, even if ratings were deleted or changed.
16. It then loads the recommendation history so the cafe owner can review previously generated recommendation sets over time.
17. Finally, it loads the latest customer reviews and allows the cafe owner to add or update an owner response when needed.

In simple terms, the recommendation insights flow turns customer ratings into understandable summaries, identifies the weakest service area, and provides guidance on what the cafe should improve first.

## Defense-Ready Script: Cafe Owner Side

Good day. For the cafe owner side of BrewHub, the main purpose is to provide cafe owners with a complete management area for their cafe operations, promotions, products, customer feedback, and communication.

First, the dashboard gives the cafe owner an overview of performance, including visits, clicks, popularity score, product count, recommendation activity, and recent updates.

Second, the My Cafe page allows the cafe owner to maintain the cafe profile. This includes editing business details, operating information, location, image, and coffee varieties.

Third, the Coupon Promos page allows the cafe owner to create and manage promotional offers. It supports promo creation, updating, deletion, status tracking, and QR-based redemption.

Fourth, the marketplace page is used to manage products and customer orders. It allows the cafe owner to create products, update them, control visibility, and process order status changes.

Fifth, the Recommendation Insights page helps the cafe owner understand customer feedback through rating summaries, category analysis, priority levels, suggested actions, and review response tools.

Sixth, the map page provides a location-based view of establishments and verified reseller locations in the system.

Seventh, the messages page allows direct communication with other users.

Finally, the notifications feature keeps the cafe owner informed about pending orders and unread chats.

Overall, the cafe owner side is designed to support both business operations and customer engagement within the BrewHub platform.

## Defense-Ready Script: Coupon Promo Flow

For the coupon promo flow, the process begins when the cafe owner opens the promos page and views the existing promo records. If the cafe owner wants to create a new promo, the required promo details are entered, such as title, description, discount type, discount value, validity period, and usage limit.

After saving, the system stores the promo under the cafe owner's establishment and generates a QR token that will be used during redemption. When a customer presents the promo, the cafe owner scans the QR code through the redeem function. The system then validates the promo token, checks the customer identity, verifies that the promo is still active, confirms that the usage limit has not yet been reached, and checks whether the same customer has already redeemed it before.

If the validation is successful, the system records the redemption and updates the promo usage count. If any validation fails, the system blocks the redemption.

In summary, the coupon promo flow helps the cafe owner create promotions and redeem them in a controlled and secure manner.

## Defense-Ready Script: Recommendation Insights Flow

For the recommendation insights flow, the system first identifies the cafe establishment linked to the logged-in cafe owner. After that, it gathers the ratings connected only to that cafe and computes the current review count, average overall rating, and rating distribution.

Next, the system computes the average scores for taste, environment, cleanliness, and service. It compares these category averages to identify which area has the lowest score. Based on that weakest category, the system assigns a priority level to show how urgent the concern is.

This process is rule-based. That means the system follows fixed thresholds and predefined recommendation rules. When a category score falls within a certain range, the system assigns a matching priority level and attaches the corresponding descriptive explanation and suggested action.

The system then prepares separate insight views for weekly, monthly, and all-time periods. For each selected period, it checks whether ratings are available before generating descriptive and prescriptive insight cards. The weakest category is placed first so the most important issue is shown immediately.

To keep the recommendation sets accurate, the system also rebuilds and reads recommendation snapshot records based on the latest ratings. This allows the cafe owner to review current insight results together with recommendation history over time, even when ratings were deleted or updated.

Finally, the system loads the latest customer reviews so the cafe owner can connect the generated insights with actual customer feedback. If needed, the cafe owner can also add or update an owner response for a review.

In summary, the recommendation insights flow helps the cafe owner understand customer feedback clearly and decide which service area should be improved first.

## Defense-Ready Closing Line: Cafe Owner Side

To summarize, the cafe owner side of BrewHub is designed to help cafe owners manage their cafe more effectively. It combines profile management, promotions, product and order handling, review analysis, messaging, notifications, and mapping into one organized working environment.

---

## Reseller Side Functionality Summary

The reseller side serves as the management area for verified resellers in BrewHub. It allows resellers to manage their business profile, maintain reseller product listings, monitor marketplace activity, handle orders, view ratings, communicate with users, and access map-based business information.

### 1. Dashboard
The dashboard provides the reseller with a quick overview of business activity. It shows total orders, listed products by type, recent orders, recent activity, and order-related trend information. This helps the reseller monitor sales activity and business performance in one page.

### 2. Profile
The profile page allows the reseller to maintain business and account information. It supports updating the reseller name, email, location details, contact information, profile photo, coffee varieties, and other reseller-specific fields that may exist in the system.

### 3. Marketplace
The marketplace page serves as the main product and order management area for the reseller. It includes the reseller's own products, other available marketplace products, customer orders, and product ratings. Through this page, the reseller can create product listings, update product details, manage stock, control product visibility, and update order status.

### 4. Product Ratings
The reseller marketplace also includes a ratings section for reseller-owned products. This allows the reseller to review customer feedback on listed products and monitor how products are performing based on user ratings.

### 5. Notifications
The notifications feature helps the reseller stay updated on important events. It highlights pending orders and unread chat messages so that the reseller can respond more quickly to customers and system activity.

### 6. Map
The map page gives the reseller a geographic view of establishments and verified reseller locations. It also includes the reseller's own location when coordinates are available. This helps the reseller understand their position within the wider BrewHub network.

### 7. Messages
The messages page allows the reseller to create conversations, read messages, send replies, and manage direct communication with other users in the system.

## Defense-Ready Script: Reseller Side

Good day. For the reseller side of BrewHub, the main purpose is to provide verified resellers with a working area for business management, product selling, customer order handling, and communication.

First, the dashboard gives the reseller a quick overview of order activity, listed products, recent transactions, and trend-based business information.

Second, the profile page allows the reseller to maintain account and business details, including contact information, location details, profile photo, and coffee variety preferences.

Third, the marketplace page serves as the main operational area for reseller products. Through this page, the reseller can create and update product listings, manage stock, control visibility, review orders, and monitor customer feedback through product ratings.

Fourth, the notifications feature helps the reseller stay aware of pending orders and unread messages.

Fifth, the map page gives the reseller a geographic view of establishments, verified reseller locations, and the reseller's own mapped location when available.

Finally, the messages page allows the reseller to communicate directly with other users inside the platform.

Overall, the reseller side is designed to support selling operations, order management, profile maintenance, and communication within the BrewHub system.

## Defense-Ready Closing Line: Reseller Side

To summarize, the reseller side of BrewHub is designed to help verified resellers manage their operations more effectively. It combines profile management, product listing, order handling, customer rating visibility, messaging, notifications, and map access into one organized business environment.

---

## Mobile App Side Functionality Summary

The mobile app side of BrewHub serves as the consumer-facing part of the system. It allows users to register and log in, explore establishments on the map, generate AI-assisted coffee trails, browse marketplace products, reserve products, cancel eligible orders, view promos, read and submit ratings, manage saved content, and communicate with sellers through the built-in messaging feature.

## Main Mobile Navigation

The main mobile app uses a bottom tab navigation plus stacked screens.

Main tab screens:
1. Map
2. Trail
3. Rating
4. Promos
5. Profile

Additional stack screens:
1. Marketplace
2. Marketplace Cart
3. Messages
4. Saved Trails
5. Saved Coffee Varieties

Authentication screens:
1. Login
2. Register
3. Forgot Password
4. Reset Password

### 1. Login Screen

The login screen allows an existing user to enter email and password, request password visibility, move to the forgot-password flow, or proceed to registration if no account exists. After successful login, the app stores the returned token and user payload and opens the authenticated app flow.

### 2. Register Screen

The register screen allows a new consumer to create an account using full name, email, password, and password confirmation. It validates required fields, email format, password length, special-character requirement, and password matching before sending the registration request.

### 3. Forgot Password Screen

The forgot-password screen allows the user to request a password reset code using the registered email address. If the request succeeds, the app routes the user to the reset-password screen and passes the normalized email.

### 4. Reset Password Screen

The reset-password screen allows the user to submit the registered email, 6-digit OTP code, new password, and confirmation password. It validates the password rules again before sending the reset request to the backend.

### 5. Map Screen

The map screen is the user's geographic exploration screen. It loads establishments and reseller locations, displays them as map markers, supports type filtering, shows marker details, displays coffee varieties, recent reviews, product ratings, and active promos, and can open external navigation links. It also supports marker-view tracking so map interactions can be counted by the backend.

### 6. Trail Screen

The trail screen is the AI Coffee Trail screen. It allows the user to select preferred coffee varieties, preferred establishment types, and the maximum number of stops. It also shows an AI recommendation preview before generation, lets the user generate a trail using the current location, view the generated stops with distance and ETA, save the trail locally, navigate the trail on the map, and view previously generated trail history from the backend.

### 7. Ratings Screen

The ratings screen has two main modes: community feed and rating form. In feed mode, the user can browse cafe ratings and farm product ratings, sort them, and view rating details with category scores. In form mode, the user can submit a new rating with taste, environment, cleanliness, and service scores, and optionally attach a photo.

### 8. Promos Screen

The promos screen allows the user to browse available coupon promos from partner establishments. It organizes promos into tabs such as all, near, expiring, and redeemed. It also uses location data to estimate distance, supports promo claiming and QR display, and tracks the user's claimed promo state locally.

### 9. Profile Screen

The profile screen serves as the consumer account and saved-content screen. It displays the profile summary, verification status, email verification flow, unread chat badge, saved trails, saved coffee varieties, saved establishments, offline download toggles for establishments, and basic account settings. It also provides access to logout.

### 10. Marketplace Screen

The marketplace screen is the product browsing and reservation area for the consumer. It loads available products, supports search and product type filtering, allows reservation setup, tracks active and historical orders, shows official receipt details, opens web receipt and rating links when needed, opens seller chat, and supports cancellation of eligible orders.

The marketplace screen is organized into three operational views:
1. Products
2. Tracking
3. History

Products are used for browsing and reservation.
Tracking is used for current active orders.
History is used for previously completed or cancelled orders.

### 11. Marketplace Cart Screen

The marketplace cart screen allows the user to review locally saved cart items, update quantities, remove items, and continue with reservation checkout. It also supports marketplace-to-web reservation handoff when needed through generated prefill links.

### 12. Messages Screen

The messages screen allows the user to view conversations, search or choose recipients, open a conversation, read message history, send new messages, and automatically mark messages as read. It also supports opening chat directly from other screens, such as marketplace seller actions.

### 13. Saved Trails Screen

The saved trails screen shows trails that the user saved locally. It presents the saved date, number of stops, total distance, total ETA, selected preferences, and each stop's address and recommendation reason. It also allows the user to remove a saved trail.

### 14. Saved Coffee Varieties Screen

The saved coffee varieties screen shows saved variety cards such as Arabica, Excelsa, Liberica, and Robusta. Each card includes overview, taste profile, characteristics, and reference content, and the user can remove the saved variety from local storage.

## Simple Process Flow: Mobile App Authentication

The authentication flow is the entry process for the consumer user.

1. The user opens the app and is shown the login screen if not authenticated.
2. If the user already has an account, the user enters email and password and logs in.
3. The backend returns an access token and user details.
4. The app stores the authenticated session and opens the main mobile screens.
5. If the user does not yet have an account, the user opens the register screen and submits the required details.
6. If the user forgets the password, the user opens the forgot-password screen and requests an OTP reset code.
7. The user then opens the reset-password screen, enters the code and new password, and completes password reset.

In simple terms, the authentication flow is how the user enters, creates, or restores access to the BrewHub mobile app.

## Simple Process Flow: Mobile App Map

The map flow is the consumer's main location exploration flow.

1. The user opens the Map screen.
2. The app requests and loads establishment and reseller map data from the backend GeoJSON endpoint.
3. The map displays establishments using their saved coordinates.
4. The user can filter by type such as farm, cafe, roaster, or reseller.
5. When a marker is selected, the app opens detailed place information.
6. The details may include address, ratings, coffee varieties, active promos, and product-rating information.
7. The app can also track marker views back to the backend for analytics.
8. If the user wants directions, the app can open external navigation links.

In simple terms, the map flow helps the user discover coffee-related places geographically and inspect their details before deciding where to go.

## Simple Process Flow: Mobile App Marketplace

The marketplace flow is the consumer's product reservation and order tracking flow.

1. The user opens the Marketplace screen.
2. The app loads available marketplace products from the backend.
3. The user can search products and filter them by type.
4. The user can open a product and start a reservation.
5. The app collects quantity, pickup date, pickup time, address, and contact number.
6. The reservation request is sent to the backend order endpoint.
7. The backend creates the order, stores reservation metadata, and sends an order receipt email.
8. The order then appears in tracking or history views depending on its status.
9. If the order is still eligible for cancellation, the consumer can cancel it from the app.
10. The cancellation request is sent to the backend API.
11. The backend validates ownership, normalizes the cancelled status, releases reserved stock when needed, updates the order, and sends the order status update email.
12. The updated cancelled order is then returned to the mobile app.

In simple terms, the marketplace flow allows the user to reserve products, monitor order progress, and cancel valid orders while keeping receipts and order history connected.

## Simple Process Flow: AI Coffee Trail

The AI Coffee Trail flow is the mobile app's guided route-generation process for coffee exploration.

Important term:
The Coffee Trail can be described as an AI-assisted route recommendation feature. It is not a generative AI chat system. It combines user preferences, nearby establishment filtering, route optimization, and recommendation hints to produce a suggested travel sequence.

1. The user opens the Trail screen.
2. The screen starts in the trail-generation tab.
3. The user selects one or more coffee varieties from options such as Liberica, Excelsa, Robusta, and Arabica.
4. The user selects one or more establishment types such as farm, cafe, roaster, or reseller.
5. The user selects the maximum number of stops, from 2 up to 5.
6. While the user is still adjusting the setup, the mobile app requests an AI preview from the backend preview endpoint.
7. The preview endpoint does not generate the final route yet. Instead, it returns a setup interpretation such as headline, summary, route hint, balance hint, suggestion, and confidence label.
8. This preview helps the user understand whether the selected setup is balanced, too narrow, or suitable for generation.
9. Once the user taps Generate Trail, the app first validates that at least one coffee variety and one visit type were chosen.
10. The app then requests foreground location permission from the device.
11. If location permission is denied, generation stops because the trail requires the user's current origin point.
12. If permission is granted, the app reads the current latitude and longitude from the device.
13. The app then sends a request to the backend trail generation endpoint with latitude, longitude, selected varieties, selected stop types, and maximum stops.
14. On the backend, the request is validated so coordinates, varieties, and route settings are all in acceptable format.
15. The backend normalizes the selected variety list and selected type list to avoid duplicates and inconsistent values.
16. The backend then searches for nearby candidate establishments that match the selected coffee varieties and selected establishment types.
17. The candidate search is intentionally capped to about twice the maximum stop count so the route optimizer works on a focused set of nearby relevant places.
18. The backend loads each candidate establishment together with its coffee varieties.
19. If no matching establishments are found, the backend returns an error saying there are no coffee establishments in range for the selected preferences.
20. If candidates are found, the backend prepares a preliminary coordinate list that starts from the user's current position and then includes the candidate stops.
21. The backend sends this coordinate list to Mapbox Optimization.
22. That first optimization request is used to identify the best route order across the larger candidate set.
23. The backend then reads the waypoint order returned by Mapbox and selects only the best-ranked stops up to the requested maximum stop count.
24. After that, the backend performs a second Mapbox optimization request using only the selected stops.
25. This second request produces the final route geometry, final total distance, and final estimated duration for the chosen trail.
26. The backend then builds the trail stop response in sequence order.
27. For each stop, the backend includes establishment ID, name, type, address, coordinates, and a `why_recommended` explanation.
28. The recommendation reason is inferred from the user's chosen coffee varieties. If a stop matches those varieties directly, the backend explains that match. If not, it still explains that the stop fits the selected route type and nearby route pattern.
29. The backend saves the generated trail to the `coffee_trails` records for the authenticated user.
30. The saved trail includes origin coordinates, selected preferences, stop data, route geometry, total distance, and total duration.
31. The backend returns the finished trail response to the mobile app.
32. The mobile app normalizes the response and computes per-leg distance and ETA values between stops using the device origin and stop coordinates.
33. The generated trail is then shown to the user as an ordered list of coffee stops.
34. The user can review the stop sequence, addresses, recommendation reasons, per-stop distance, and ETA.
35. The user can then open the trail on the map for route viewing.
36. The user can also save the trail locally to AsyncStorage.
37. The app compares the generated trail signature against previously saved trails so duplicate saves can be detected.
38. When a trail is generated successfully, the app also inserts that trail into the visible history state.
39. If the user opens the Trail History tab, the app requests the saved trail history from the backend.
40. The backend returns previously generated trail records for that user, ordered by latest first.
41. The app then shows those historical trail entries with stop count, total distance, total ETA, and timestamps.

In simple terms, the AI Coffee Trail flow starts with user preferences and current location, filters the best nearby coffee-related places, uses route optimization to arrange them efficiently, explains why the stops were chosen, saves the result, and returns a ready-to-follow coffee exploration route.

## Defense-Ready Script: Mobile App Side

Good day. For the mobile app side of BrewHub, the main purpose is to provide consumers with a complete coffee exploration and reservation experience.

First, the authentication screens allow the user to register, log in, request a password reset code, and reset the password using OTP verification.

Second, the Map screen allows the user to explore farms, cafes, roasters, and resellers geographically. It also lets the user inspect place details such as address, ratings, coffee varieties, and active promos.

Third, the AI Coffee Trail screen allows the user to generate a guided coffee route based on selected coffee varieties, selected visit types, current location, and preferred number of stops. It also shows an AI preview before generation, displays the generated stops with route information, and keeps a trail history for the user.

Fourth, the Ratings screen allows the user to browse the community ratings feed and submit new ratings for establishments and farm products.

Fifth, the Promos screen allows the user to browse nearby and active coupon promos, claim them, and use QR-based promo details.

Sixth, the Marketplace screen allows the user to browse products, place reservations, review receipt details, track order status, and cancel eligible orders.

Seventh, the Messages screen allows the user to communicate directly with sellers and other users inside the platform.

Finally, the Profile screen lets the user manage saved trails, saved coffee varieties, saved establishments, offline items, verification status, and account settings.

Overall, the mobile app side is designed to combine discovery, route planning, ratings, promos, ordering, and communication into one consumer-friendly experience.

## Defense-Ready Script: AI Coffee Trail Flow

For the AI Coffee Trail flow, the process starts when the user opens the Trail screen and selects the preferred coffee varieties, preferred stop types, and the maximum number of stops.

Before generating the final trail, the app first requests an AI preview from the backend. This preview gives the user a short explanation of what kind of route setup the current selections will likely produce. It may describe whether the trail is balanced, farm-focused, cafe-focused, compact, or longer in pacing.

When the user taps Generate Trail, the app checks that the setup is complete and then requests the device's current location. After getting the coordinates, the app sends the location and selected preferences to the backend generation endpoint.

On the backend, the system first validates the request and finds nearby candidate establishments that match the selected coffee varieties and selected establishment types. It then uses Mapbox Optimization to arrange those candidates into an efficient route order. After identifying the best sequence, it narrows the route down to the requested number of stops and performs a final optimization request to get the final route distance, route duration, and route geometry.

The backend then builds the final trail result. Each stop includes the place name, type, address, coordinates, and a short explanation of why it was recommended. The generated trail is also saved to the user's trail history in the backend.

After that, the mobile app receives the trail, computes per-leg distance and ETA for display, and shows the final list of stops to the user. The user can view the trail on the map, save it locally, and later review it again through the trail history screen.

In summary, the AI Coffee Trail flow combines user preferences, location awareness, nearby establishment filtering, route optimization, recommendation reasoning, and saved history into one guided coffee exploration feature.

## Defense-Ready Closing Line: Mobile App Side

To summarize, the mobile app side of BrewHub is designed to help consumers discover coffee places, generate optimized coffee trails, redeem promos, submit ratings, reserve products, and communicate with sellers through one connected mobile experience.