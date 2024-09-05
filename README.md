# Upload an OpenAPI specification to a Discourse topic

We use [rapidoc](https://rapidocweb.com/) as a
[Discourse](https://discourse.org/)
[theme component](https://github.com/wwerner/discourse-rapidoc-theme-component)
to render [OpenAPI specifications](https://swagger.io/specification/) in forum
posts. This repository provides a GitHub action to upload the specification file
and update a given topic with the newly uploaded file.

## Prerequisites / Inputs

- `DISCOURSE_URL` - your discourse instance domain, e.g.
  "community.developer.gridx.de
- `DISCOURSE_POST_ID` - the ID of the Discourse post to update, you can find it,
  e.g., by inspecting your post in the browser and looking for
  `data-post-id="<n>"` in the `article` element. (XPath
  `//article/@data-post-id`) ![Discourse Post ID](doc-post-id.png)
- `DISCOURSE_API_KEY` - your discourse API key. It needs `posts - edit` and
  `uploads - create` permissions.
  ![Discourse API Key](doc-discourse-api-key.png)
- `DISCOURSE_API_USER` - the discourse user on whose behalf the action should be
  executed.

## Instructions

1. Create a topic that hosts your specification on your Discourse instance using
   https://github.com/wwerner/discourse-rapidoc-theme-component
