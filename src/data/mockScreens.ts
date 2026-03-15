import type { ComponentNode } from '../types/mokkoi'

export const loginScreenTree: ComponentNode = {
  type: 'SafeAreaView',
  style: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  children: [
    {
      type: 'ScrollView',
      props: {
        contentContainerStyle: {
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 28,
          paddingVertical: 40,
        },
      },
      children: [
        // Logo / brand area
        {
          type: 'View',
          style: {
            alignItems: 'center',
            marginBottom: 36,
          },
          children: [
            {
              type: 'View',
              style: {
                width: 64,
                height: 64,
                borderRadius: 20,
                background: 'linear-gradient(135deg, #818CF8 0%, #6366F1 50%, #4F46E5 100%)',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 18,
                boxShadow: '0 8px 32px rgba(99, 102, 241, 0.4)',
              },
              children: [
                {
                  type: 'Text',
                  style: {
                    fontSize: 28,
                    fontWeight: '800',
                    color: '#FFFFFF',
                    letterSpacing: -1,
                  },
                  children: ['M'],
                },
              ],
            },
            {
              type: 'Text',
              style: {
                fontSize: 24,
                fontWeight: '800',
                color: '#F8FAFC',
                marginBottom: 6,
                letterSpacing: -0.5,
              },
              children: ['Welcome back'],
            },
            {
              type: 'Text',
              style: {
                fontSize: 14,
                color: '#64748B',
                letterSpacing: 0.2,
              },
              children: ['Sign in to continue building'],
            },
          ],
        },

        // Email field
        {
          type: 'View',
          style: { marginBottom: 14 },
          children: [
            {
              type: 'Text',
              style: {
                fontSize: 12,
                fontWeight: '600',
                color: '#94A3B8',
                marginBottom: 8,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              },
              children: ['Email'],
            },
            {
              type: 'View',
              style: {
                flexDirection: 'row',
                alignItems: 'center',
                height: 48,
                backgroundColor: '#1E293B',
                borderRadius: 12,
                paddingHorizontal: 14,
                borderWidth: 1,
                borderColor: '#334155',
                gap: 10,
              },
              children: [
                {
                  type: 'Text',
                  style: { fontSize: 16 },
                  children: ['\u2709\uFE0F'],
                },
                {
                  type: 'Text',
                  style: { fontSize: 14, color: '#475569' },
                  children: ['you@example.com'],
                },
              ],
            },
          ],
        },

        // Password field
        {
          type: 'View',
          style: { marginBottom: 8 },
          children: [
            {
              type: 'Text',
              style: {
                fontSize: 12,
                fontWeight: '600',
                color: '#94A3B8',
                marginBottom: 8,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              },
              children: ['Password'],
            },
            {
              type: 'View',
              style: {
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: 48,
                backgroundColor: '#1E293B',
                borderRadius: 12,
                paddingHorizontal: 14,
                borderWidth: 1,
                borderColor: '#334155',
              },
              children: [
                {
                  type: 'View',
                  style: { flexDirection: 'row', alignItems: 'center', gap: 10 },
                  children: [
                    {
                      type: 'Text',
                      style: { fontSize: 16 },
                      children: ['\uD83D\uDD12'],
                    },
                    {
                      type: 'Text',
                      style: { fontSize: 14, color: '#475569', letterSpacing: 3 },
                      children: ['\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'],
                    },
                  ],
                },
                {
                  type: 'Text',
                  style: { fontSize: 14 },
                  children: ['\uD83D\uDC41\uFE0F'],
                },
              ],
            },
          ],
        },

        // Forgot password
        {
          type: 'TouchableOpacity',
          style: {
            alignSelf: 'flex-end',
            marginBottom: 24,
            paddingVertical: 4,
          },
          children: [
            {
              type: 'Text',
              style: {
                fontSize: 13,
                color: '#818CF8',
                fontWeight: '600',
              },
              children: ['Forgot password?'],
            },
          ],
        },

        // Sign in button - gradient CTA
        {
          type: 'TouchableOpacity',
          style: {
            height: 50,
            background: 'linear-gradient(135deg, #818CF8 0%, #6366F1 50%, #4F46E5 100%)',
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
            boxShadow: '0 4px 24px rgba(99, 102, 241, 0.35)',
          },
          children: [
            {
              type: 'Text',
              style: {
                fontSize: 16,
                fontWeight: '700',
                color: '#FFFFFF',
                letterSpacing: 0.5,
              },
              children: ['Sign In'],
            },
          ],
        },

        // "or" divider
        {
          type: 'View',
          style: {
            flexDirection: 'row',
            alignItems: 'center',
            marginVertical: 18,
          },
          children: [
            {
              type: 'View',
              style: { flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, #334155)' },
            },
            {
              type: 'Text',
              style: {
                fontSize: 11,
                color: '#475569',
                paddingHorizontal: 14,
                fontWeight: '500',
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              },
              children: ['or'],
            },
            {
              type: 'View',
              style: { flex: 1, height: 1, background: 'linear-gradient(90deg, #334155, transparent)' },
            },
          ],
        },

        // Social buttons row
        {
          type: 'View',
          style: {
            flexDirection: 'row',
            gap: 12,
            marginBottom: 32,
          },
          children: [
            {
              type: 'TouchableOpacity',
              style: {
                flex: 1,
                height: 48,
                backgroundColor: '#1E293B',
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                borderWidth: 1,
                borderColor: '#334155',
              },
              children: [
                {
                  type: 'Text',
                  style: { fontSize: 18 },
                  children: ['\uD83C\uDF10'],
                },
                {
                  type: 'Text',
                  style: { fontSize: 14, color: '#F8FAFC', fontWeight: '600' },
                  children: ['Google'],
                },
              ],
            },
            {
              type: 'TouchableOpacity',
              style: {
                flex: 1,
                height: 48,
                backgroundColor: '#1E293B',
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                borderWidth: 1,
                borderColor: '#334155',
              },
              children: [
                {
                  type: 'Text',
                  style: { fontSize: 18 },
                  children: ['\uD83C\uDF4E'],
                },
                {
                  type: 'Text',
                  style: { fontSize: 14, color: '#F8FAFC', fontWeight: '600' },
                  children: ['Apple'],
                },
              ],
            },
          ],
        },

        // Sign up link
        {
          type: 'View',
          style: {
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 4,
          },
          children: [
            {
              type: 'Text',
              style: { fontSize: 13, color: '#64748B' },
              children: ["Don't have an account?"],
            },
            {
              type: 'TouchableOpacity',
              children: [
                {
                  type: 'Text',
                  style: {
                    fontSize: 13,
                    color: '#818CF8',
                    fontWeight: '700',
                  },
                  children: ['Sign Up'],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

export const homeScreenTree: ComponentNode = {
  type: 'SafeAreaView',
  style: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  children: [
    // Gradient header area
    {
      type: 'View',
      style: {
        background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 24,
        borderBottomWidth: 1,
        borderColor: '#1E293B',
      },
      children: [
        // Top row: greeting + avatar + notification
        {
          type: 'View',
          style: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 24,
          },
          children: [
            {
              type: 'View',
              children: [
                {
                  type: 'Text',
                  style: { fontSize: 13, color: '#64748B', marginBottom: 2, letterSpacing: 0.3 },
                  children: ['Good morning \u2600\uFE0F'],
                },
                {
                  type: 'Text',
                  style: { fontSize: 22, fontWeight: '800', color: '#F8FAFC', letterSpacing: -0.5 },
                  children: ['Alex'],
                },
              ],
            },
            {
              type: 'View',
              style: { flexDirection: 'row', alignItems: 'center', gap: 12 },
              children: [
                // Notification bell
                {
                  type: 'View',
                  style: {
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: '#1E293B',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: '#334155',
                  },
                  children: [
                    {
                      type: 'Text',
                      style: { fontSize: 18 },
                      children: ['\uD83D\uDD14'],
                    },
                  ],
                },
                // Avatar
                {
                  type: 'View',
                  style: {
                    width: 42,
                    height: 42,
                    borderRadius: 14,
                    background: 'linear-gradient(135deg, #818CF8, #6366F1)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                  },
                  children: [
                    {
                      type: 'Text',
                      style: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
                      children: ['A'],
                    },
                  ],
                },
              ],
            },
          ],
        },

        // Featured card with gradient
        {
          type: 'View',
          style: {
            background: 'linear-gradient(135deg, #6366F1 0%, #818CF8 50%, #A78BFA 100%)',
            borderRadius: 18,
            padding: 20,
            boxShadow: '0 8px 32px rgba(99, 102, 241, 0.3)',
          },
          children: [
            {
              type: 'View',
              style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
              children: [
                {
                  type: 'View',
                  children: [
                    {
                      type: 'Text',
                      style: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 4, fontWeight: '500' },
                      children: ['Weekly Progress'],
                    },
                    {
                      type: 'Text',
                      style: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', letterSpacing: -1 },
                      children: ['84%'],
                    },
                  ],
                },
                {
                  type: 'View',
                  style: {
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                  children: [
                    {
                      type: 'Text',
                      style: { fontSize: 18 },
                      children: ['\uD83D\uDE80'],
                    },
                  ],
                },
              ],
            },
            // Progress bar
            {
              type: 'View',
              style: {
                height: 6,
                borderRadius: 3,
                backgroundColor: 'rgba(255,255,255,0.2)',
                overflow: 'hidden',
              },
              children: [
                {
                  type: 'View',
                  style: {
                    width: '84%',
                    height: '100%',
                    borderRadius: 3,
                    backgroundColor: '#FFFFFF',
                  },
                },
              ],
            },
            {
              type: 'Text',
              style: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 8 },
              children: ['21 of 25 tasks completed this week'],
            },
          ],
        },
      ],
    },

    {
      type: 'ScrollView',
      props: {
        contentContainerStyle: {
          paddingHorizontal: 20,
          paddingVertical: 20,
        },
      },
      children: [
        // Stats cards row
        {
          type: 'View',
          style: {
            flexDirection: 'row',
            gap: 12,
            marginBottom: 24,
          },
          children: [
            {
              type: 'View',
              style: {
                flex: 1,
                backgroundColor: '#1E293B',
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: '#334155',
              },
              children: [
                {
                  type: 'View',
                  style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
                  children: [
                    {
                      type: 'Text',
                      style: { fontSize: 11, color: '#64748B', fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
                      children: ['Tasks'],
                    },
                    {
                      type: 'Text',
                      style: { fontSize: 16 },
                      children: ['\u2705'],
                    },
                  ],
                },
                {
                  type: 'Text',
                  style: { fontSize: 26, fontWeight: '800', color: '#F8FAFC', marginBottom: 4, letterSpacing: -1 },
                  children: ['12'],
                },
                {
                  type: 'View',
                  style: {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    backgroundColor: 'rgba(52, 211, 153, 0.1)',
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                    alignSelf: 'flex-start',
                  },
                  children: [
                    {
                      type: 'Text',
                      style: { fontSize: 10 },
                      children: ['\u2191'],
                    },
                    {
                      type: 'Text',
                      style: { fontSize: 11, color: '#34D399', fontWeight: '600' },
                      children: ['+3 today'],
                    },
                  ],
                },
              ],
            },
            {
              type: 'View',
              style: {
                flex: 1,
                backgroundColor: '#1E293B',
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: '#334155',
              },
              children: [
                {
                  type: 'View',
                  style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
                  children: [
                    {
                      type: 'Text',
                      style: { fontSize: 11, color: '#64748B', fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
                      children: ['Streak'],
                    },
                    {
                      type: 'Text',
                      style: { fontSize: 16 },
                      children: ['\uD83D\uDD25'],
                    },
                  ],
                },
                {
                  type: 'Text',
                  style: { fontSize: 26, fontWeight: '800', color: '#F8FAFC', marginBottom: 4, letterSpacing: -1 },
                  children: ['7d'],
                },
                {
                  type: 'View',
                  style: {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    backgroundColor: 'rgba(251, 191, 36, 0.1)',
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                    alignSelf: 'flex-start',
                  },
                  children: [
                    {
                      type: 'Text',
                      style: { fontSize: 10 },
                      children: ['\u2B50'],
                    },
                    {
                      type: 'Text',
                      style: { fontSize: 11, color: '#FBBF24', fontWeight: '600' },
                      children: ['Best!'],
                    },
                  ],
                },
              ],
            },
          ],
        },

        // Recent section header
        {
          type: 'View',
          style: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
          },
          children: [
            {
              type: 'Text',
              style: {
                fontSize: 16,
                fontWeight: '700',
                color: '#F8FAFC',
                letterSpacing: -0.3,
              },
              children: ['Recent Activity'],
            },
            {
              type: 'Text',
              style: { fontSize: 13, color: '#818CF8', fontWeight: '600' },
              children: ['See all'],
            },
          ],
        },

        // Activity items
        ...[
          { title: 'Design review completed', time: '2m ago', icon: '\u2705', color: '#34D399' },
          { title: 'New comment on PR #42', time: '15m ago', icon: '\uD83D\uDCAC', color: '#818CF8' },
          { title: 'Build succeeded', time: '1h ago', icon: '\u26A1', color: '#34D399' },
          { title: 'Sprint planning updated', time: '3h ago', icon: '\uD83D\uDCCB', color: '#FBBF24' },
        ].map((item): ComponentNode => ({
          type: 'View',
          style: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#1E293B',
            borderRadius: 14,
            padding: 14,
            marginBottom: 8,
            gap: 12,
            borderWidth: 1,
            borderColor: '#334155',
          },
          children: [
            {
              type: 'View',
              style: {
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: `${item.color}15`,
                alignItems: 'center',
                justifyContent: 'center',
              },
              children: [
                {
                  type: 'Text',
                  style: { fontSize: 16 },
                  children: [item.icon],
                },
              ],
            },
            {
              type: 'View',
              style: { flex: 1 },
              children: [
                {
                  type: 'Text',
                  style: { fontSize: 13, color: '#F8FAFC', fontWeight: '600' },
                  children: [item.title],
                },
                {
                  type: 'Text',
                  style: { fontSize: 11, color: '#475569', marginTop: 2 },
                  children: [item.time],
                },
              ],
            },
            {
              type: 'Text',
              style: { fontSize: 16, color: '#334155' },
              children: ['\u203A'],
            },
          ],
        })),
      ],
    },
  ],
}

export const profileScreenTree: ComponentNode = {
  type: 'SafeAreaView',
  style: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  children: [
    {
      type: 'ScrollView',
      props: {
        contentContainerStyle: {
          paddingBottom: 32,
        },
      },
      children: [
        // Cover photo area
        {
          type: 'View',
          style: {
            height: 120,
            background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 30%, #818CF8 60%, #A78BFA 100%)',
            position: 'relative',
          },
          children: [
            // Settings icon overlay
            {
              type: 'View',
              style: {
                position: 'absolute',
                top: 12,
                right: 16,
                width: 32,
                height: 32,
                borderRadius: 10,
                backgroundColor: 'rgba(0,0,0,0.3)',
                alignItems: 'center',
                justifyContent: 'center',
              },
              children: [
                {
                  type: 'Text',
                  style: { fontSize: 16 },
                  children: ['\u2699\uFE0F'],
                },
              ],
            },
          ],
        },

        // Avatar overlapping cover
        {
          type: 'View',
          style: {
            alignItems: 'center',
            marginTop: -40,
            marginBottom: 12,
          },
          children: [
            {
              type: 'View',
              style: {
                width: 84,
                height: 84,
                borderRadius: 42,
                background: 'linear-gradient(135deg, #818CF8, #6366F1)',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 4,
                borderColor: '#0F172A',
                boxShadow: '0 4px 20px rgba(99, 102, 241, 0.3)',
                position: 'relative',
              },
              children: [
                {
                  type: 'Text',
                  style: { fontSize: 32, fontWeight: '800', color: '#FFFFFF' },
                  children: ['A'],
                },
              ],
            },
            // Online indicator
            {
              type: 'View',
              style: {
                width: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: '#34D399',
                borderWidth: 3,
                borderColor: '#0F172A',
                position: 'absolute',
                bottom: 2,
                right: '37%',
              },
            },
          ],
        },

        // Name and handle
        {
          type: 'View',
          style: { alignItems: 'center', marginBottom: 16, paddingHorizontal: 20 },
          children: [
            {
              type: 'Text',
              style: { fontSize: 20, fontWeight: '800', color: '#F8FAFC', marginBottom: 4, letterSpacing: -0.5 },
              children: ['Alex Turner'],
            },
            {
              type: 'Text',
              style: { fontSize: 13, color: '#818CF8', fontWeight: '500', marginBottom: 10 },
              children: ['@alexturner'],
            },
            {
              type: 'Text',
              style: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 20 },
              children: ['Product designer & developer. Building beautiful interfaces with Mokkoi.'],
            },
          ],
        },

        // Stats row: followers / following / posts
        {
          type: 'View',
          style: {
            flexDirection: 'row',
            marginHorizontal: 20,
            backgroundColor: '#1E293B',
            borderRadius: 16,
            padding: 18,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: '#334155',
          },
          children: [
            ...[
              { label: 'Followers', value: '2.4K' },
              { label: 'Following', value: '518' },
              { label: 'Posts', value: '142' },
            ].map((stat, i): ComponentNode => ({
              type: 'View',
              style: {
                flex: 1,
                alignItems: 'center',
                borderRightWidth: i < 2 ? 1 : 0,
                borderColor: '#334155',
              },
              children: [
                {
                  type: 'Text',
                  style: { fontSize: 20, fontWeight: '800', color: '#F8FAFC', marginBottom: 2 },
                  children: [stat.value],
                },
                {
                  type: 'Text',
                  style: { fontSize: 11, color: '#64748B', fontWeight: '500' },
                  children: [stat.label],
                },
              ],
            })),
          ],
        },

        // Action buttons: Edit Profile + Share
        {
          type: 'View',
          style: {
            flexDirection: 'row',
            gap: 10,
            paddingHorizontal: 20,
            marginBottom: 24,
          },
          children: [
            {
              type: 'TouchableOpacity',
              style: {
                flex: 1,
                height: 44,
                background: 'linear-gradient(135deg, #6366F1, #818CF8)',
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(99, 102, 241, 0.25)',
              },
              children: [
                {
                  type: 'Text',
                  style: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
                  children: ['Edit Profile'],
                },
              ],
            },
            {
              type: 'TouchableOpacity',
              style: {
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: '#1E293B',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: '#334155',
              },
              children: [
                {
                  type: 'Text',
                  style: { fontSize: 18 },
                  children: ['\uD83D\uDD17'],
                },
              ],
            },
          ],
        },

        // Menu items
        ...[
          { label: 'Notifications', icon: '\uD83D\uDD14' },
          { label: 'Privacy & Security', icon: '\uD83D\uDD12' },
          { label: 'Help & Support', icon: '\uD83D\uDCA1' },
          { label: 'Log Out', icon: '\uD83D\uDEAA' },
        ].map((item): ComponentNode => ({
          type: 'TouchableOpacity',
          style: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#1E293B',
            borderRadius: 14,
            paddingVertical: 14,
            paddingHorizontal: 16,
            marginBottom: 8,
            marginHorizontal: 20,
            borderWidth: 1,
            borderColor: '#334155',
          },
          children: [
            {
              type: 'View',
              style: { flexDirection: 'row', alignItems: 'center', gap: 12 },
              children: [
                {
                  type: 'Text',
                  style: { fontSize: 18 },
                  children: [item.icon],
                },
                {
                  type: 'Text',
                  style: {
                    fontSize: 14,
                    color: item.label === 'Log Out' ? '#F87171' : '#F8FAFC',
                    fontWeight: '500',
                  },
                  children: [item.label],
                },
              ],
            },
            {
              type: 'Text',
              style: { fontSize: 16, color: '#475569' },
              children: ['\u203A'],
            },
          ],
        })),
      ],
    },
  ],
}

export const chatScreenTree: ComponentNode = {
  type: 'SafeAreaView',
  style: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  children: [
    // Chat header
    {
      type: 'View',
      style: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderColor: '#1E293B',
        gap: 12,
      },
      children: [
        {
          type: 'Text',
          style: { fontSize: 18, color: '#94A3B8' },
          children: ['\u2190'],
        },
        {
          type: 'View',
          style: {
            width: 36,
            height: 36,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #F472B6, #EC4899)',
            alignItems: 'center',
            justifyContent: 'center',
          },
          children: [
            {
              type: 'Text',
              style: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
              children: ['JD'],
            },
          ],
        },
        {
          type: 'View',
          style: { flex: 1 },
          children: [
            {
              type: 'Text',
              style: { fontSize: 15, fontWeight: '700', color: '#F8FAFC' },
              children: ['Jane Doe'],
            },
            {
              type: 'Text',
              style: { fontSize: 11, color: '#34D399' },
              children: ['Online'],
            },
          ],
        },
        {
          type: 'Text',
          style: { fontSize: 20 },
          children: ['\uD83D\uDCDE'],
        },
      ],
    },

    // Messages area
    {
      type: 'ScrollView',
      props: {
        contentContainerStyle: {
          paddingHorizontal: 16,
          paddingVertical: 16,
          gap: 12,
        },
      },
      children: [
        // Timestamp
        {
          type: 'View',
          style: { alignItems: 'center', marginBottom: 4 },
          children: [
            {
              type: 'Text',
              style: { fontSize: 11, color: '#475569', fontWeight: '500' },
              children: ['Today, 2:34 PM'],
            },
          ],
        },

        // Received message
        {
          type: 'View',
          style: { alignItems: 'flex-start', maxWidth: '80%' },
          children: [
            {
              type: 'View',
              style: {
                backgroundColor: '#1E293B',
                borderRadius: 18,
                borderBottomLeftRadius: 4,
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderWidth: 1,
                borderColor: '#334155',
              },
              children: [
                {
                  type: 'Text',
                  style: { fontSize: 14, color: '#F8FAFC', lineHeight: 20 },
                  children: ['Hey! Have you seen the new designs? They look amazing \uD83D\uDE0D'],
                },
              ],
            },
            {
              type: 'Text',
              style: { fontSize: 10, color: '#475569', marginTop: 4, marginLeft: 4 },
              children: ['2:34 PM'],
            },
          ],
        },

        // Sent message
        {
          type: 'View',
          style: { alignItems: 'flex-end', alignSelf: 'flex-end', maxWidth: '80%' },
          children: [
            {
              type: 'View',
              style: {
                background: 'linear-gradient(135deg, #6366F1, #818CF8)',
                borderRadius: 18,
                borderBottomRightRadius: 4,
                paddingHorizontal: 16,
                paddingVertical: 10,
                boxShadow: '0 2px 8px rgba(99, 102, 241, 0.2)',
              },
              children: [
                {
                  type: 'Text',
                  style: { fontSize: 14, color: '#FFFFFF', lineHeight: 20 },
                  children: ['Yes! The new components are so clean. Shipping it today!'],
                },
              ],
            },
            {
              type: 'Text',
              style: { fontSize: 10, color: '#475569', marginTop: 4, marginRight: 4 },
              children: ['2:35 PM \u2713\u2713'],
            },
          ],
        },

        // Received message
        {
          type: 'View',
          style: { alignItems: 'flex-start', maxWidth: '80%' },
          children: [
            {
              type: 'View',
              style: {
                backgroundColor: '#1E293B',
                borderRadius: 18,
                borderBottomLeftRadius: 4,
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderWidth: 1,
                borderColor: '#334155',
              },
              children: [
                {
                  type: 'Text',
                  style: { fontSize: 14, color: '#F8FAFC', lineHeight: 20 },
                  children: ['Can you share the Figma link? I want to review the tokens too'],
                },
              ],
            },
            {
              type: 'Text',
              style: { fontSize: 10, color: '#475569', marginTop: 4, marginLeft: 4 },
              children: ['2:36 PM'],
            },
          ],
        },

        // Sent message
        {
          type: 'View',
          style: { alignItems: 'flex-end', alignSelf: 'flex-end', maxWidth: '80%' },
          children: [
            {
              type: 'View',
              style: {
                background: 'linear-gradient(135deg, #6366F1, #818CF8)',
                borderRadius: 18,
                borderBottomRightRadius: 4,
                paddingHorizontal: 16,
                paddingVertical: 10,
                boxShadow: '0 2px 8px rgba(99, 102, 241, 0.2)',
              },
              children: [
                {
                  type: 'Text',
                  style: { fontSize: 14, color: '#FFFFFF', lineHeight: 20 },
                  children: ['Sure, sending it now \uD83D\uDC4D'],
                },
              ],
            },
            {
              type: 'Text',
              style: { fontSize: 10, color: '#475569', marginTop: 4, marginRight: 4 },
              children: ['2:36 PM \u2713'],
            },
          ],
        },

        // Typing indicator
        {
          type: 'View',
          style: { alignItems: 'flex-start', marginTop: 4 },
          children: [
            {
              type: 'View',
              style: {
                backgroundColor: '#1E293B',
                borderRadius: 18,
                borderBottomLeftRadius: 4,
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderWidth: 1,
                borderColor: '#334155',
              },
              children: [
                {
                  type: 'View',
                  style: { flexDirection: 'row', gap: 4, alignItems: 'center' },
                  children: [
                    {
                      type: 'View',
                      style: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#64748B' },
                    },
                    {
                      type: 'View',
                      style: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#94A3B8' },
                    },
                    {
                      type: 'View',
                      style: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#64748B' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },

    // Input bar at bottom
    {
      type: 'View',
      style: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 10,
        borderTopWidth: 1,
        borderColor: '#1E293B',
      },
      children: [
        {
          type: 'Text',
          style: { fontSize: 22 },
          children: ['\u2795'],
        },
        {
          type: 'View',
          style: {
            flex: 1,
            height: 40,
            backgroundColor: '#1E293B',
            borderRadius: 20,
            paddingHorizontal: 16,
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: '#334155',
          },
          children: [
            {
              type: 'Text',
              style: { fontSize: 13, color: '#475569' },
              children: ['Type a message...'],
            },
          ],
        },
        {
          type: 'View',
          style: {
            width: 36,
            height: 36,
            borderRadius: 18,
            background: 'linear-gradient(135deg, #6366F1, #818CF8)',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
          },
          children: [
            {
              type: 'Text',
              style: { fontSize: 16, color: '#FFFFFF' },
              children: ['\u2191'],
            },
          ],
        },
      ],
    },
  ],
}

export const dashboardScreenTree: ComponentNode = {
  type: 'SafeAreaView',
  style: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  children: [
    // Header
    {
      type: 'View',
      style: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
      },
      children: [
        {
          type: 'View',
          children: [
            {
              type: 'Text',
              style: { fontSize: 13, color: '#64748B', marginBottom: 2 },
              children: ['Total Balance'],
            },
            {
              type: 'Text',
              style: { fontSize: 11, color: '#34D399', fontWeight: '600' },
              children: ['+12.4% this month'],
            },
          ],
        },
        {
          type: 'View',
          style: {
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: '#1E293B',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: '#334155',
          },
          children: [
            {
              type: 'Text',
              style: { fontSize: 16 },
              children: ['\u26A1'],
            },
          ],
        },
      ],
    },

    {
      type: 'ScrollView',
      props: {
        contentContainerStyle: {
          paddingHorizontal: 20,
          paddingBottom: 20,
        },
      },
      children: [
        // Balance card
        {
          type: 'View',
          style: {
            background: 'linear-gradient(135deg, #1E293B 0%, #334155 100%)',
            borderRadius: 20,
            padding: 22,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: '#475569',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          },
          children: [
            {
              type: 'Text',
              style: { fontSize: 32, fontWeight: '800', color: '#F8FAFC', letterSpacing: -1, marginBottom: 16 },
              children: ['$24,562.80'],
            },
            // Mini chart placeholder - bar chart rows
            {
              type: 'View',
              style: {
                flexDirection: 'row',
                alignItems: 'flex-end',
                gap: 6,
                height: 48,
                marginBottom: 16,
              },
              children: [
                ...[40, 65, 45, 80, 55, 90, 70, 95, 60, 85, 75, 100].map((h): ComponentNode => ({
                  type: 'View',
                  style: {
                    flex: 1,
                    height: `${h}%`,
                    borderRadius: 3,
                    background: h >= 80
                      ? 'linear-gradient(180deg, #818CF8, #6366F1)'
                      : 'linear-gradient(180deg, #334155, #1E293B)',
                  },
                })),
              ],
            },
            // Month labels
            {
              type: 'View',
              style: { flexDirection: 'row', justifyContent: 'space-between' },
              children: [
                { type: 'Text', style: { fontSize: 9, color: '#475569' }, children: ['Jan'] } as ComponentNode,
                { type: 'Text', style: { fontSize: 9, color: '#475569' }, children: ['Apr'] } as ComponentNode,
                { type: 'Text', style: { fontSize: 9, color: '#475569' }, children: ['Jul'] } as ComponentNode,
                { type: 'Text', style: { fontSize: 9, color: '#475569' }, children: ['Oct'] } as ComponentNode,
              ],
            },
          ],
        },

        // Quick action buttons
        {
          type: 'View',
          style: {
            flexDirection: 'row',
            gap: 10,
            marginBottom: 24,
          },
          children: [
            ...[
              { icon: '\u2191', label: 'Send', gradient: 'linear-gradient(135deg, #6366F1, #818CF8)' },
              { icon: '\u2193', label: 'Receive', gradient: 'linear-gradient(135deg, #059669, #34D399)' },
              { icon: '\u2194', label: 'Swap', gradient: 'linear-gradient(135deg, #D97706, #FBBF24)' },
            ].map((action): ComponentNode => ({
              type: 'TouchableOpacity',
              style: {
                flex: 1,
                alignItems: 'center',
                gap: 8,
              },
              children: [
                {
                  type: 'View',
                  style: {
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    background: action.gradient,
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                  },
                  children: [
                    {
                      type: 'Text',
                      style: { fontSize: 18, color: '#FFFFFF', fontWeight: '700' },
                      children: [action.icon],
                    },
                  ],
                },
                {
                  type: 'Text',
                  style: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },
                  children: [action.label],
                },
              ],
            })),
          ],
        },

        // Recent transactions header
        {
          type: 'View',
          style: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
          },
          children: [
            {
              type: 'Text',
              style: { fontSize: 16, fontWeight: '700', color: '#F8FAFC', letterSpacing: -0.3 },
              children: ['Recent Transactions'],
            },
            {
              type: 'Text',
              style: { fontSize: 13, color: '#818CF8', fontWeight: '600' },
              children: ['See all'],
            },
          ],
        },

        // Transaction list
        ...[
          { name: 'Spotify', category: 'Subscription', amount: '-$9.99', icon: '\uD83C\uDFB5', color: '#34D399', positive: false },
          { name: 'Salary Deposit', category: 'Income', amount: '+$4,200', icon: '\uD83C\uDFE6', color: '#818CF8', positive: true },
          { name: 'Amazon', category: 'Shopping', amount: '-$67.50', icon: '\uD83D\uDCE6', color: '#FBBF24', positive: false },
          { name: 'Figma Pro', category: 'Subscription', amount: '-$15.00', icon: '\uD83C\uDFA8', color: '#F472B6', positive: false },
          { name: 'Transfer In', category: 'Transfer', amount: '+$500', icon: '\uD83D\uDCB8', color: '#34D399', positive: true },
        ].map((tx): ComponentNode => ({
          type: 'View',
          style: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#1E293B',
            borderRadius: 14,
            padding: 14,
            marginBottom: 8,
            gap: 12,
            borderWidth: 1,
            borderColor: '#334155',
          },
          children: [
            {
              type: 'View',
              style: {
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: `${tx.color}15`,
                alignItems: 'center',
                justifyContent: 'center',
              },
              children: [
                {
                  type: 'Text',
                  style: { fontSize: 18 },
                  children: [tx.icon],
                },
              ],
            },
            {
              type: 'View',
              style: { flex: 1 },
              children: [
                {
                  type: 'Text',
                  style: { fontSize: 14, color: '#F8FAFC', fontWeight: '600' },
                  children: [tx.name],
                },
                {
                  type: 'Text',
                  style: { fontSize: 11, color: '#475569', marginTop: 2 },
                  children: [tx.category],
                },
              ],
            },
            {
              type: 'Text',
              style: {
                fontSize: 14,
                fontWeight: '700',
                color: tx.positive ? '#34D399' : '#F8FAFC',
              },
              children: [tx.amount],
            },
          ],
        })),
      ],
    },
  ],
}

export const MOCK_SCREEN_TREES: Record<string, ComponentNode> = {
  HomeScreen: homeScreenTree,
  ProfileScreen: profileScreenTree,
  LoginScreen: loginScreenTree,
  ChatScreen: chatScreenTree,
  DashboardScreen: dashboardScreenTree,
}
