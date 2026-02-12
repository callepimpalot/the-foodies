/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Enforcing Zinc as the primary neutral palette
                zinc: {
                    50: '#fafafa',
                    100: '#f4f4f5',
                    200: '#e4e4e7', // designated for subtle borders (zinc-200/50)
                    300: '#d4d4d8',
                    400: '#a1a1aa', // muted secondary text
                    500: '#71717a',
                    600: '#52525b',
                    700: '#3f3f46',
                    800: '#27272a',
                    900: '#18181b',
                    950: '#09090b',
                }
            },
            fontFamily: {
                // "Geist Sans" for all typography
                sans: ['"Geist Sans"', 'sans-serif'],
            },
            borderRadius: {
                // Ensuring '2xl' is available for containers and cards
                '2xl': '1rem',
            },
            spacing: {
                // Prioritizing high whitespace
                '128': '32rem',
            }
        },
    },
    plugins: [],
}
