<script &&>
  return projects
      .map((project) => {
          return c.project({...p, ...project, ...project[language] });
      })
      .join("\n");
</script>
