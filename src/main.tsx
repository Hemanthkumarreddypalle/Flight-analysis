import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import { Navigate, createBrowserRouter, RouterProvider } from "react-router-dom";
import AppRouteError from "./AppRouteError";
import StartupErrorBoundary from "./StartupErrorBoundary";
import "./index.css";

const AuthCallback = React.lazy(() => import("./AuthCallback"));
const AuthStart = React.lazy(() => import("./AuthStart"));
const AuthenticatedRoute = React.lazy(() => import("./AuthenticatedRoute"));
const Home = React.lazy(() => import("./Home"));

const router = createBrowserRouter(
  [
    {
      path: "/",
      errorElement: <AppRouteError />,
      element: (
        <Suspense fallback={<div>Loading route...</div>}>
          <AuthenticatedRoute />
        </Suspense>
      ),
      children: [
        {
          path: "/",
          element: (
            <Suspense fallback={<div>Loading dashboard...</div>}>
              <Home />
            </Suspense>
          ),
        },
      ],
    },
    {
      path: "/auth/start",
      errorElement: <AppRouteError />,
      element: (
        <Suspense fallback={<div>Starting authentication...</div>}>
          <AuthStart />
        </Suspense>
      ),
    },
    {
      // This is the route defined in your application's redirect URL
      path: "/auth/callback/*",
      errorElement: <AppRouteError />,
      element: (
        <Suspense fallback={<div>Loading authentication...</div>}>
          <AuthCallback />
        </Suspense>
      ),
    },
    {
      path: "*",
      element: <Navigate to="/" replace={true} />,
    },
  ],
  { basename: import.meta.env.BASE_URL },
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StartupErrorBoundary>
    <RouterProvider router={router} />
  </StartupErrorBoundary>,
);
