# Community & Family Management Mini Program

[![中文文档](https://img.shields.io/badge/文档-中文版-blue.svg)](./README_CN.md)

This project is a robust WeChat Mini Program designed for community interaction, family/group management, and content sharing. It is built upon the [TDesign Miniprogram Starter](https://github.com/TDesignOteam/tdesign-miniprogram-starter) and leverages WeChat Cloud Development (Cloud Functions & Database) for a serverless backend.

## 🌟 Key Features

### 👤 User & Social
*   **User Profiles:** Customized user profiles with editing capabilities.
*   **Social Feed (Home):** Browse posts, view details, and interact.
*   **Interactions:** Like posts, comment on threads, and search functionality.
*   **Notifications:** Real-time system for tracking interactions and updates.
*   **Chat:** Integrated chat interface (`pages/chat`).

### 👨‍👩‍👧 Family/Group Management
*   **Family Hub:** Dedicated section for family or group listings (`pages/family`).
*   **Family Details:** Detailed views for specific family groups (`pages/family-detail`).
*   **Management:** Tools to manage family members and settings (`cloudfunctions/manageFamily`).

### 🛡️ Verification & Security
*   **Identity Verification:** Workflows for personal and family verification (`pages/verify`).
*   **Content Safety:** Automated text and image checks via `contentCheck` cloud function to comply with platform regulations.

### 🔧 Admin Dashboard
*   **Verification Approvals:** Admin interface to review and approve verification requests (`pages/admin/verify`).
*   **Banner Management:** Manage homepage banners (`pages/admin/banner-manager`).

### 📸 Other Features
*   **Photo Wall:** Visual gallery for sharing moments (`pages/photowall`).
*   **Data Center:** Statistics and analytics view (`pages/dataCenter`).

## 🛠 Tech Stack

*   **Frontend:** WeChat Mini Program (WXML, WXSS, JavaScript/JSON)
*   **UI Framework:** [TDesign Miniprogram](https://tdesign.tencent.com/miniprogram)
*   **Backend:** WeChat Cloud Development (Serverless)
    *   **Cloud Functions:** Node.js
    *   **Database:** Cloud Database (NoSQL)
    *   **Storage:** Cloud Storage for images/media

## 📂 Project Structure

```text
├── cloudfunctions/             # Backend logic (Node.js)
│   ├── adminAction/            # Administrative tasks
│   ├── contentCheck/           # Text/Image security filtering
│   ├── getNotifications/       # Fetch user notifications
│   ├── getPosts/               # Retrieve community posts
│   ├── manageFamily/           # Family group CRUD operations
│   ├── managePost/             # Post creation and deletion
│   ├── manageReaction/         # Likes and interaction handling
│   ├── submitVerification/     # Handle user verification requests
│   └── ...
├── components/                 # Reusable UI components
│   ├── card/                   # Generic card component
│   ├── post-card/              # Feed post display component
│   ├── post-skeleton/          # Loading state skeleton
│   └── ...
├── pages/                      # Application views
│   ├── admin/                  # Admin dashboard
│   ├── family/                 # Family list view
│   ├── home/                   # Main feed/homepage
│   ├── login/                  # Authentication pages
│   ├── my/                     # User profile and settings
│   ├── notifications/          # Notification center
│   ├── photowall/              # Image gallery
│   ├── verify/                 # Verification forms
│   └── ...
├── static/                     # Static assets (images, icons)
├── app.js                      # App entry point
├── app.json                    # Global configuration
└── project.config.json         # Project settings
```

## 🚀 Getting Started

### Prerequisites
*   [WeChat Developer Tools](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
*   Node.js & npm installed

### Installation

1.  **Clone/Download** the repository.
2.  **Install Dependencies:**
    Open a terminal in the project root and run:
    ```bash
    npm install
    ```
3.  **Build NPM:**
    In WeChat Developer Tools, go to `Tools` -> `Build npm`.

### Cloud Configuration

1.  **Enable Cloud Development:** In the developer tools, click the "Cloud" button to set up a cloud environment.
2.  **Upload Cloud Functions:**
    *   Right-click on the `cloudfunctions` folder.
    *   Select your active cloud environment.
    *   Choose "Upload and Deploy: Cloud Installation (Install dependencies)".
3.  **Database Initialization:**
    *   Check `cloudfunctions/initDb` (if available) or manually create collections required by the app (e.g., `posts`, `users`, `families`, `notifications`).

## 🤝 Contribution

Contributions are welcome! Please ensure you test your changes in the WeChat Developer Tools simulator before submitting.

## 📄 License

This project is based on TDesign Starter (MIT License).