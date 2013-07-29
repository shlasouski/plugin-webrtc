package com.foga.plugin;

import java.io.File;
import org.eclipse.jetty.server.handler.ContextHandlerCollection;
import org.eclipse.jetty.webapp.WebAppContext;
import org.jivesoftware.openfire.container.Plugin;
import org.jivesoftware.openfire.container.PluginManager;
import org.jivesoftware.openfire.http.HttpBindManager;
import org.jivesoftware.util.JiveGlobals;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class WebRTCPlugin implements Plugin {

	private static Logger Log = LoggerFactory.getLogger(WebRTCPlugin.class);
	private static final String NAME = "webrtc";

	@Override
	public void initializePlugin(PluginManager manager, File pluginDirectory) {
		final String appName = JiveGlobals.getProperty("webrtc.webapp.name", NAME);

		try {
			final ContextHandlerCollection contexts = HttpBindManager.getInstance().getContexts();

			try {
				Log.info("[" + NAME + "] initialize " + NAME + " initialize Web App " + appName);
				final WebAppContext context = new WebAppContext(contexts, pluginDirectory.getPath(), "/" + appName);
				context.setWelcomeFiles(new String[] { "index.html" });
			} catch (Exception e) {
				Log.error("An error has occurred", e);
			}
		} catch (Exception e) {
			Log.error("Error initializing WebSockets Plugin", e);
		}
	}

	@Override
	public void destroyPlugin() {
		// TODO Auto-generated method stub

	}

}
