<script &&>
  return projects
      .map((project) => {
          return c.project({...p, ...project[language], name: project.name });
      })
      .join("\n");
</script>
