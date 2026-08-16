/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // "The Chit Rail" — kitchen order-ticket brand system
                board: '#14211B',
                board2: '#1C2C24',
                line: '#33493B',
                chalk: '#EDE7D8',
                chalkDim: '#93A395',
                ticket: '#F1E7CC',
                ticket2: '#EADFBE',
                ticketShadow: '#D8C495',
                ink: '#251C10',
                inkDim: '#6B5D45',
                stamp: '#C1442C',
                stampInk: '#9C3620',
                grease: '#B98523',
                done: '#5C7A4E',
            },
            fontFamily: {
                display: ['"Anton"', 'sans-serif'],
                head: ['"Zilla Slab"', 'serif'],
                body: ['"IBM Plex Sans"', 'sans-serif'],
                mono: ['"IBM Plex Mono"', 'monospace'],
                // default `sans` now points at the UI body face
                sans: ['"IBM Plex Sans"', 'sans-serif'],
            },
            borderRadius: {
                xs: '3px',
                sm: '6px',
                md: '10px',
                lg: '14px',
                // '2xl' kept for any leftover default-scale references during the rebuild
                '2xl': '14px',
            },
            spacing: {
                // Prioritizing high whitespace
                '128': '32rem',
            }
        },
    },
    plugins: [],
}
