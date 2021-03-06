const StoryblokClient = require('storyblok-js-client')
const { differenceBy } = require('lodash')

const Sync = {
  targetComponents: [],
  sourceComponents: [],

  init(options) {
    this.sourceSpaceId = options.source
    this.targetSpaceId = options.target
    this.client = new StoryblokClient({
      oauthToken: options.token
    }, options.api)
    this.targetClient = options.targetApi ? new StoryblokClient({
      oauthToken: options.targetToken
    }, options.targetApi) : this.client
  },

  async syncStories(){
    var targetFolders = await this.targetClient.getAll(`spaces/${this.targetSpaceId}/stories`, {
      folder_only: 1,
      sort_by: 'slug:asc'
    })

    var folderMapping = {}

    for (var i = 0; i < targetFolders.length; i++) {
      var folder = targetFolders[i]
      folderMapping[folder.full_slug] = folder.id
    }

    var all = await this.client.getAll(`spaces/${this.sourceSpaceId}/stories`, {
      story_only: 1
    })

    for (var i = 0; i < all.length; i++) {
      console.log('starting update ' + all[i].full_slug)

      var storyResult = await this.client.get('spaces/' + this.sourceSpaceId + '/stories/' + all[i].id)
      var sourceStory = storyResult.data.story
      var slugs = sourceStory.full_slug.split('/')
      var folderId = 0

      if (slugs.length > 1) {
        slugs.pop()
        var folderSlug = slugs.join('/')

        if (folderMapping[folderSlug]) {
          folderId = folderMapping[folderSlug]
        } else {
          console.log('the folder does not exist ' + folderSlug)
          continue;
        }
      }

      sourceStory.parent_id = folderId

      try {
        var existingStory = await this.targetClient.get('spaces/' + this.targetSpaceId + '/stories', {with_slug: all[i].full_slug})
        var payload = {
          story: sourceStory,
          force_update: '1'
        }
        if (sourceStory.published) {
          payload['publish'] = '1'
        }

        if (existingStory.data.stories.length == 1) {
          var updateResult = await this.targetClient.put('spaces/' + this.targetSpaceId + '/stories/' + existingStory.data.stories[0].id, payload)
          console.log('updated ' + existingStory.data.stories[0].full_slug)
        } else {
          var updateResult = await this.targetClient.post('spaces/' + this.targetSpaceId + '/stories', payload)
          console.log('created ' + sourceStory.full_slug)
        }
      } catch(e) {
        console.log(e)
      }
    }

    return all
  },

  async syncFolders() {
    let sourceFolders = await this.client.getAll(`spaces/${this.sourceSpaceId}/stories`, {
      folder_only: 1,
      sort_by: 'slug:asc'
    })
    let syncedFolders = {}

    for (var i = 0; i < sourceFolders.length; i++) {
      let folder = sourceFolders[i]
      let folderId = folder.id
      delete folder.id
      delete folder.created_at

      if (folder.parent_id) {
        // Parent child resolving
        if (!syncedFolders[folderId]) {
          let folderSlug = folder.full_slug.split('/')
          let parentFolderSlug = folderSlug.splice(0, folderSlug.length - 1).join('/')

          let existingFolders = await this.targetClient.get(`spaces/${this.targetSpaceId}/stories`, {
              with_slug: parentFolderSlug
          })

          if (existingFolders.data.stories.length) {
            folder.parent_id = existingFolders.data.stories[0].id
          } else {
            folder.parent_id = 0
          }
        } else {
          folder.parent_id = syncedFolders[folderId]
        }
      }

      try {
        let newFolder = await this.targetClient.post(`spaces/${this.targetSpaceId}/stories`, {
          story: folder
        })

        syncedFolders[folderId] = newFolder.data.story.id
        console.log(`Folder ${newFolder.data.story.name} created`)
      } catch(e) {
        console.log(`Folder ${folder.name} already exists`)
      }
    }
  },

  async syncRoles() {
    let existingFolders = await this.client.getAll(`spaces/${this.targetSpaceId}/stories`, {
      folder_only: 1,
      sort_by: 'slug:asc'
    })

    let roles = await this.client.get(`spaces/${this.sourceSpaceId}/space_roles`)
    let existingRoles = await this.targetClient.get(`spaces/${this.targetSpaceId}/space_roles`)

    for (var i = 0; i < roles.data.space_roles.length; i++) {
      let space_role = roles.data.space_roles[i]
      delete space_role.id
      delete space_role.created_at

      space_role.allowed_paths = []

      space_role.resolved_allowed_paths.forEach((path) => {
        let folders = existingFolders.filter((story) => {
          return story.full_slug + '/' == path
        })

        if (folders.length) {
          space_role.allowed_paths.push(folders[0].id)
        }
      })

      let existingRole = existingRoles.data.space_roles.filter((role) => {
        return role.role == space_role.role
      })
      if (existingRole.length) {
        await this.targetClient.put(`spaces/${this.targetSpaceId}/space_roles/${existingRole[0].id}`, {
          space_role: space_role
        })
      } else {
        await this.targetClient.post(`spaces/${this.targetSpaceId}/space_roles`, {
          space_role: space_role
        })
      }
      console.log(`Role ${space_role.role} synced`)
    }
  },

  async syncComponents() {
    this.sourceComponents = await this.client.get(`spaces/${this.sourceSpaceId}/components`)
    this.targetComponents = await this.targetClient.get(`spaces/${this.targetSpaceId}/components`)

    // create missing groups
    this.sourceGroups = await this.client.get(`spaces/${this.sourceSpaceId}/component_groups`)
    this.targetGroups = await this.targetClient.get(`spaces/${this.targetSpaceId}/component_groups`)
    const sourceComponentGroupsData = this.sourceGroups.data.component_groups
    const targetComponentGroupsData = this.targetGroups.data.component_groups
    const diffGroups = differenceBy(sourceComponentGroupsData, targetComponentGroupsData, 'name')

    for(const group of diffGroups) {
      console.log('group.name: ', group.name)
      const resp = await this.targetClient.post(`spaces/${this.targetSpaceId}/component_groups/`, {
        "component_group": {
          "name": group.name
        }
      })
      targetComponentGroupsData.push(resp.data.component_group)
    }
    
    for (var i = 0; i < this.sourceComponents.data.components.length; i++) {
      let component = this.sourceComponents.data.components[i]

      delete component.id
      delete component.created_at

      // update group uuid
      if(component.component_group_uuid) {
        sourceGroup = sourceComponentGroupsData.find(group => group.uuid === component.component_group_uuid)
        targetGroup = targetComponentGroupsData.find(group => group.name === sourceGroup.name)
        component.component_group_uuid = targetGroup.uuid
      }


      // Create new component on target space
      try {
        await this.targetClient.post(`spaces/${this.targetSpaceId}/components`, {
          component: component
        })
        console.log(`Component ${component.name} synced`)
      } catch(e) {
        if (e.response.status == 422) {
          await this.targetClient.put(`spaces/${this.targetSpaceId}/components/${this.getTargetComponentId(component.name)}`, {
            component: component
          })
          console.log(`Component ${component.name} synced`)
        } else {
          console.log(`Component ${component.name} sync failed`)
        }
      }
    }
  },

  getTargetComponentId(name) {
    let comps = this.targetComponents.data.components.filter((comp) => {
      return comp.name == name
    })

    return comps[0].id
  },

  async syncDatasources() {
    if (this.sourceSpaceId === this.targetSpaceId) {
      console.warn('Source space id is same to target space id. No sync required')
      return
    }
    this.targetDatasources = await this.targetClient.get(`spaces/${this.targetSpaceId}/datasources?per_page=1000&page=1`)
    this.sourceDatasources = await this.client.get(`spaces/${this.sourceSpaceId}/datasources?per_page=1000&page=1`)

    const updateDatasourceEntries = async (sourceDatasource, targetDatasource) => {
      const sourceDatasourceEntries = await this.client.get(`spaces/${this.sourceSpaceId}/datasource_entries?per_page=1000&page=1`, {
        datasource_id: sourceDatasource.id
      })

      const targetDatasourceEntries = await this.targetClient.get(`spaces/${this.targetSpaceId}/datasource_entries?per_page=1000&page=1`, {
        datasource_id: targetDatasource.id
      })
      for (let index = 0; index < sourceDatasourceEntries.data.datasource_entries.length; index++) {
        const sde = sourceDatasourceEntries.data.datasource_entries[index];
        const tde = targetDatasourceEntries.data.datasource_entries.find(tde => tde.name === sde.name)
        if (tde) {
          if (tde.value !== sde.value) {
            this.targetClient.put(`spaces/${this.targetSpaceId}/datasource_entries/${tde.id}`, {
              datasource_entry: {
                ...tde,
                value: sde.value
              }
            })
          }
        } else {
          this.targetClient.post(`spaces/${this.targetSpaceId}/datasource_entries`, {
            datasource_entry: {
              ...sde,
              datasource_id: targetDatasource.id
            }
          })
        }
      }
    }

    for (var i = 0; i < this.sourceDatasources.data.datasources.length; i++) {
      let datasource = this.sourceDatasources.data.datasources[i]
      
      // Create new datasource entry on target space
      try {
        const response = await this.targetClient.post(`spaces/${this.targetSpaceId}/datasources`, {
          datasource: datasource
        })
        updateDatasourceEntries(datasource, response.data.datasource)
        console.log(`Datasource ${datasource.name} synced`)
      } catch(e) {
        if (e.response.status == 422) {
          const response = await this.targetClient.put(`spaces/${this.targetSpaceId}/datasources/${this.getTargetDatasourceId(datasource.name)}`, {
            datasource: datasource
          })
          updateDatasourceEntries(datasource, response.data.datasource)
          console.log(`Datasource ${datasource.name} synced`)
        } else {
          console.log(`Datasource ${datasource.name} sync failed`)
        }
      }
    }
  },

  getTargetDatasourceId(name) {
    let datasources = this.targetDatasources.data.datasources.filter((datasource) => {
      return datasource.name == name
    })
  
    return datasources[0].id
  },
}

exports.handler = async function (event, context) {
  console.log(`Executing command ${event.options.command}`)
  Sync.init(event.options)
  await Sync[event.options.command]()

  return {
    statusCode: '200',
    body: JSON.stringify({success: 'Synced'})
  }
}