import { AppPlugin, PluginExtensionPanelContext, PluginExtensionPoints } from '@grafana/data';
import React from 'react';
import { AppConfig } from './components/AppConfig';
import { AnalyzePage } from './pages';
import { PanelAnalysisModal, ExploreAnalysisModal } from './extensions/AnalysisModal';
import { PLUGIN_ID } from './constants';

export const plugin = new AppPlugin<{}>()
  .setRootPage(AnalyzePage)
  .addConfigPage({
    title: 'Configuration',
    icon: 'cog',
    body: AppConfig,
    id: 'configuration',
  })
  .addLink<PluginExtensionPanelContext>({
    title: 'Analyze with LLM',
    description: 'Send this panel to AI for analysis',
    targets: [PluginExtensionPoints.DashboardPanelMenu],
    category: 'Extensions',
    onClick: (event, helpers) => {
      const panelContext = helpers?.context;
      if (helpers?.openModal) {
        helpers.openModal({
          title: '🤖 Analyze Panel with LLM',
          body: ({ onDismiss }) =>
            React.createElement(PanelAnalysisModal, { context: panelContext, onDismiss }),
          width: '60%',
          height: '80vh',
        });
      }
    },
  })
  .addLink({
    title: 'Analyze with LLM',
    description: 'Analyze current query results with AI',
    targets: [PluginExtensionPoints.ExploreToolbarAction],
    onClick: (_event, helpers) => {
      if (helpers?.openModal) {
        helpers.openModal({
          title: '🤖 Analyze with LLM',
          body: ({ onDismiss }) => React.createElement(ExploreAnalysisModal, { onDismiss }),
          width: '60%',
          height: '80vh',
        });
      }
    },
  })
  .addLink({
    title: 'LLM Analysis',
    description: 'Open LLM Analysis page',
    targets: [PluginExtensionPoints.CommandPalette],
    path: `/a/${PLUGIN_ID}`,
  });
